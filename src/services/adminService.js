const mongoose = require('mongoose');
const Order = require('../models/order');
const Payment = require('../models/payment');
const User = require('../models/User');
const Product = require('../models/product');
const Event = require('../models/adminEvent');
const Session = require('../models/session');
const settings = require('./storeSettingsService');
const orders = require('./storeOrderService');
const {
  AuthError
} = require('./authService');
const agregar = (Model, pipeline) => Model.aggregate(pipeline).option({ maxTimeMS: 5000 });
const estados = ['aguardando_pagamento', 'pago', 'em_preparacao', 'enviado', 'entregue', 'cancelado'];
const regex = texto => new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
function filtros(query = {}) {
  const ambiente = query.ambiente || 'todos';
  if (!['todos', 'teste', 'producao'].includes(ambiente)) throw new AuthError('Ambiente inválido.');
  const env = ambiente === 'todos' ? {} : {
    ambienteTeste: ambiente === 'teste' ? true : {
      $ne: true
    }
  };
  let periodo;
  if (query.de || query.ate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.de || '') || !/^\d{4}-\d{2}-\d{2}$/.test(query.ate || '')) throw new AuthError('Informe o início e o fim do período.');
    const inicio = new Date(`${query.de}T00:00:00-03:00`),
      fim = new Date(`${query.ate}T23:59:59.999-03:00`);
    if (!Number.isFinite(+inicio) || !Number.isFinite(+fim) || inicio > fim || fim - inicio > 366 * 86400000 || inicio.toISOString().slice(0, 10) !== query.de || fim.toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo'
    }) !== query.ate) throw new AuthError('Período inválido. Use no máximo 366 dias.');
    periodo = {
      $gte: inicio,
      $lte: fim
    };
  }
  const pagina = Number(query.pagina || 1),
    limite = Number(query.limite || 20);
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 10000 || !Number.isSafeInteger(limite) || limite < 1 || limite > 100 || typeof (query.busca || '') !== 'string' || (query.busca || '').length > 100) throw new AuthError('Paginação ou busca inválida.');
  return {
    env,
    periodo,
    pagina,
    limite,
    busca: (query.busca || '').trim(),
    ambiente
  };
}
async function registrar(actorId, acao, entidadeId, descricao = '', session) {
  if (!actorId) return;
  await Event.create([{
    actorId,
    acao,
    entidadeId: String(entidadeId),
    descricao
  }], {
    session
  });
}
async function resumo(query) {
  const {
    env,
    periodo
  } = filtros(query);
  const filtroPedidos = {
    ...env,
    ...(periodo ? {
      createdAt: periodo
    } : {})
  };
  const config = await settings.configuracao();
  const [porStatus, clientes, estoque, financeiro] = await Promise.all([agregar(Order, [{
    $match: filtroPedidos
  }, {
    $group: {
      _id: '$status',
      quantidade: {
        $sum: 1
      },
      valor: {
        $sum: '$totalCentavos'
      },
      valorPago: {
        $sum: {
          $cond: ['$pagoEm', '$totalCentavos', 0]
        }
      },
      pagos: {
        $sum: {
          $cond: ['$pagoEm', 1, 0]
        }
      }
    }
  }]), User.countDocuments({
    role: 'client',
    ...(periodo ? {
      createdAt: periodo
    } : {})
  }).maxTimeMS(5000), agregar(Product, [{
    $match: {
      ativo: true
    }
  }, {
    $unwind: '$variacoes'
  }, {
    $match: {
      'variacoes.ativo': true,
      'variacoes.estoqueDisponivel': {
        $lte: config.estoqueCritico
      }
    }
  }, {
    $project: {
      nome: 1,
      sku: '$variacoes.sku',
      disponivel: '$variacoes.estoqueDisponivel'
    }
  }, {
    $limit: 100
  }]), agregar(Payment, [{
    $lookup: {
      from: 'orders',
      localField: 'orderId',
      foreignField: '_id',
      as: 'pedido'
    }
  }, {
    $unwind: '$pedido'
  }, {
    $match: Object.fromEntries(Object.entries(env).map(([k, v]) => [`pedido.${k}`, v]))
  }, {
    $facet: {
      recebimentos: [{
        $match: {
          capturedCentavos: {
            $gt: 0
          },
          ...(periodo ? {
            aprovadoEm: periodo
          } : {})
        }
      }, {
        $group: {
          _id: null,
          bruto: {
            $sum: '$capturedCentavos'
          },
          taxas: {
            $sum: '$taxasCentavos'
          },
          semTaxas: {
            $sum: {
              $cond: [{
                $eq: [{
                  $ifNull: ['$taxasCentavos', null]
                }, null]
              }, 1, 0]
            }
          }
        }
      }],
      devolucoes: [{
        $match: {
          refundSucceededCentavos: {
            $gt: 0
          },
          ...(periodo ? {
            refundUpdatedAt: periodo
          } : {})
        }
      }, {
        $group: {
          _id: null,
          total: {
            $sum: '$refundSucceededCentavos'
          }
        }
      }],
      pendentes: [{
        $match: {
          status: {
            $in: ['pendente', 'em_processamento']
          },
          ...(periodo ? {
            createdAt: periodo
          } : {})
        }
      }, {
        $count: 'total'
      }],
      evolucao: [{
        $match: {
          capturedCentavos: {
            $gt: 0
          },
          ...(periodo ? {
            aprovadoEm: periodo
          } : {})
        }
      }, {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$aprovadoEm',
              timezone: 'America/Sao_Paulo'
            }
          },
          brutoCentavos: {
            $sum: '$capturedCentavos'
          },
          transacoes: {
            $sum: 1
          }
        }
      }, {
        $sort: {
          _id: -1
        }
      }, {
        $limit: 366
      }, {
        $sort: {
          _id: 1
        }
      }]
    }
  }])]);
  const totalPedidos = porStatus.reduce((s, p) => s + p.quantidade, 0);
  const pedidosPagos = porStatus.reduce((s, p) => s + p.pagos, 0);
  const f = financeiro[0] || {},
    recebido = f.recebimentos?.[0] || {};
  const bruto = recebido.bruto || 0,
    reembolsos = f.devolucoes?.[0]?.total || 0;
  const [maisVendidos, recorrentes] = await Promise.all([agregar(Order, [{
    $match: {
      ...env,
      status: {
        $in: ['pago', 'em_preparacao', 'enviado', 'entregue']
      },
      ...(periodo ? {
        pagoEm: periodo
      } : {})
    }
  }, {
    $unwind: '$itens'
  }, {
    $group: {
      _id: '$itens.variantId',
      nome: {
        $first: '$itens.nomeProduto'
      },
      quantidade: {
        $sum: '$itens.quantidade'
      },
      totalCentavos: {
        $sum: '$itens.totalLiquidoCentavos'
      }
    }
  }, {
    $sort: {
      quantidade: -1
    }
  }, {
    $limit: 10
  }]), agregar(Order, [{
    $match: {
      ...env,
      pagoEm: periodo || {
        $ne: null
      }
    }
  }, {
    $group: {
      _id: '$userId',
      compras: {
        $sum: 1
      }
    }
  }, {
    $match: {
      compras: {
        $gt: 1
      }
    }
  }, {
    $count: 'total'
  }])]);
  return {
    atualizadoEm: new Date(),
    ambiente: query?.ambiente || 'todos',
    indicadores: {
      faturamentoBrutoCentavos: bruto,
      reembolsosCentavos: reembolsos,
      receitaAposReembolsosCentavos: bruto - reembolsos,
      taxasCentavos: recebido.semTaxas > 0 ? null : recebido.taxas || 0,
      totalPedidos,
      pedidosPagos,
      pedidosPendentes: porStatus.find(p => p._id === 'aguardando_pagamento')?.quantidade || 0,
      pedidosEntregues: porStatus.find(p => p._id === 'entregue')?.quantidade || 0,
      ticketMedioCentavos: pedidosPagos ? Math.round(porStatus.reduce((s, p) => s + (p.valorPago || 0), 0) / pedidosPagos) : 0,
      conversaoPedidos: totalPedidos ? Math.round(pedidosPagos / totalPedidos * 1000) / 10 : 0,
      clientes,
      clientesRecorrentes: recorrentes[0]?.total || 0,
      pagamentosPendentes: f.pendentes?.[0]?.total || 0
    },
    porStatus,
    evolucao: f.evolucao || [],
    maisVendidos,
    estoqueCritico: estoque
  };
}
async function listarPedidos(query) {
  const f = filtros(query),
    filtro = {
      ...f.env,
      ...(f.periodo ? {
        createdAt: f.periodo
      } : {})
    };
  if (query.status) {
    if (!estados.includes(query.status)) throw new AuthError('Status de pedido inválido.');
    filtro.status = query.status;
  }
  const pipeline = [{
    $match: filtro
  }, {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      pipeline: [{
        $project: {
          nome: 1,
          email: 1
        }
      }],
      as: 'cliente'
    }
  }, {
    $unwind: {
      path: '$cliente',
      preserveNullAndEmptyArrays: true
    }
  }];
  if (f.busca) pipeline.push({
    $match: {
      $or: [{
        'cliente.nome': regex(f.busca)
      }, {
        'cliente.email': regex(f.busca)
      }, {
        'itens.nomeProduto': regex(f.busca)
      }, ...(mongoose.isObjectIdOrHexString(f.busca) ? [{
        _id: new mongoose.Types.ObjectId(f.busca)
      }] : [])]
    }
  });
  pipeline.push({
    $sort: {
      createdAt: -1,
      _id: -1
    }
  }, {
    $facet: {
      total: [{
        $count: 'n'
      }],
      lista: [{
        $skip: (f.pagina - 1) * f.limite
      }, {
        $limit: f.limite
      }]
    }
  });
  const resultado = (await agregar(Order, pipeline))[0];
  return {
    total: resultado?.total[0]?.n || 0,
    pagina: f.pagina,
    limite: f.limite,
    pedidos: (resultado?.lista || []).map(p => ({
      ...orders.publico(p),
      cliente: p.cliente || null
    }))
  };
}
async function detalhePedido(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new AuthError('Pedido não encontrado.', 404);
  const pedido = await Order.findById(id).maxTimeMS(5000);
  if (!pedido) throw new AuthError('Pedido não encontrado.', 404);
  const [cliente, pagamentos, historico] = await Promise.all([User.findById(pedido.userId).select('nome email ativo').maxTimeMS(5000).lean(), Payment.find({
    orderId: id
  }).sort({
    createdAt: -1
  }).maxTimeMS(5000).lean(), Event.find({
    entidadeId: id
  }).sort({
    createdAt: -1
  }).limit(100).select('acao descricao createdAt').maxTimeMS(5000).lean()]);
  return {
    pedido: {
      ...orders.publico(pedido),
      cliente
    },
    pagamentos: pagamentos.map(pagamentoPublico),
    historico
  };
}
function pagamentoPublico(p) {
  return {
    id: String(p._id),
    pedidoId: String(p.orderId),
    clienteId: String(p.userId),
    referencia: p.providerPaymentId,
    metodo: p.metodo,
    status: p.status,
    valorCentavos: p.valorCentavos,
    capturadoCentavos: p.capturedCentavos,
    reembolsadoCentavos: p.refundSucceededCentavos,
    taxasCentavos: p.taxasCentavos ?? null,
    criadoEm: p.createdAt,
    aprovadoEm: p.aprovadoEm,
    ultimaConsultaEm: p.ultimaConsultaEm
  };
}
async function listarPagamentos(query) {
  const f = filtros(query);
  const match = {
    ...(f.periodo ? {
      createdAt: f.periodo
    } : {})
  };
  if (query.status) {
    if (!['criado', 'pendente', 'em_processamento', 'aprovado', 'recusado', 'cancelado', 'reembolsado'].includes(query.status)) throw new AuthError('Status financeiro inválido.');
    match.status = query.status;
  }
  const pipeline = [{
    $match: match
  }, {
    $lookup: {
      from: 'orders',
      localField: 'orderId',
      foreignField: '_id',
      as: 'pedido'
    }
  }, {
    $unwind: '$pedido'
  }, {
    $match: Object.fromEntries(Object.entries(f.env).map(([k, v]) => [`pedido.${k}`, v]))
  }, {
    $sort: {
      createdAt: -1,
      _id: -1
    }
  }, {
    $facet: {
      total: [{
        $count: 'n'
      }],
      lista: [{
        $skip: (f.pagina - 1) * f.limite
      }, {
        $limit: f.limite
      }]
    }
  }];
  const result = (await agregar(Payment, pipeline))[0];
  return {
    total: result?.total[0]?.n || 0,
    pagina: f.pagina,
    limite: f.limite,
    pagamentos: (result?.lista || []).map(p => ({
      ...pagamentoPublico(p),
      ambienteTeste: p.pedido.ambienteTeste
    }))
  };
}
async function listarClientes(query) {
  const f = filtros(query),
    filtro = {
      role: 'client',
      ...(f.periodo ? {
        createdAt: f.periodo
      } : {})
    };
  if (f.busca) filtro.$or = [{
    nome: regex(f.busca)
  }, {
    email: regex(f.busca)
  }];
  const [total, clientes] = await Promise.all([User.countDocuments(filtro).maxTimeMS(5000), User.find(filtro).select('nome email cpf ativo emailVerificado createdAt').sort({
    createdAt: -1
  }).skip((f.pagina - 1) * f.limite).limit(f.limite).maxTimeMS(5000).lean()]);
  const pedidos = await agregar(Order, [{
    $match: {
      userId: {
        $in: clientes.map(c => c._id)
      },
      ...f.env
    }
  }, {
    $group: {
      _id: '$userId',
      totalPedidos: {
        $sum: 1
      },
      ultimaCompra: {
        $max: '$createdAt'
      },
      comprasConfirmadas: {
        $sum: {
          $cond: [{
            $in: ['$status', ['pago', 'em_preparacao', 'enviado', 'entregue']]
          }, 1, 0]
        }
      },
      totalCompradoCentavos: {
        $sum: {
          $cond: [{
            $in: ['$status', ['pago', 'em_preparacao', 'enviado', 'entregue']]
          }, '$totalCentavos', 0]
        }
      }
    }
  }]);
  return {
    total,
    pagina: f.pagina,
    limite: f.limite,
    clientes: clientes.map(c => ({
      id: String(c._id),
      nome: c.nome,
      email: c.email,
      cpf: c.cpf || null,
      ativo: c.ativo,
      emailVerificado: c.emailVerificado,
      criadoEm: c.createdAt,
      ...(pedidos.find(p => String(p._id) === String(c._id)) || {
        totalPedidos: 0,
        comprasConfirmadas: 0,
        totalCompradoCentavos: 0
      })
    }))
  };
}
async function alterarPedido(id, dados, actorId) {
  const transicoes = {
    pago: 'em_preparacao',
    em_preparacao: 'enviado',
    enviado: 'entregue'
  };
  if (!mongoose.isObjectIdOrHexString(id) || !Object.values(transicoes).includes(dados?.status) || Object.keys(dados).some(campo => !['status', 'codigoRastreio'].includes(campo)) || (dados.codigoRastreio !== undefined && (typeof dados.codigoRastreio !== 'string' || dados.codigoRastreio.length > 100))) throw new AuthError('Dados de atualização inválidos.');
  await mongoose.connection.transaction(async session => {
    const pedido = await Order.findOne({
      _id: id,
      cancelamentoSolicitadoEm: null
    }).session(session);
    if (!pedido || transicoes[pedido.status] !== dados.status || !pedido.pagoEm) throw new AuthError('O pedido mudou ou não está pago. Atualize os dados antes de continuar.', 409);
    const anterior = pedido.status;
    pedido.status = dados.status;
    if (dados.codigoRastreio !== undefined) pedido.codigoRastreio = dados.codigoRastreio.trim();
    await pedido.save({
      session
    });
    await registrar(actorId, 'pedido.status', id, `${anterior} → ${pedido.status}`, session);
  });
  return detalhePedido(id);
}
async function alterarCliente(id, dados, actorId) {
  if (!mongoose.isObjectIdOrHexString(id) || typeof dados?.ativo !== 'boolean' || Object.keys(dados).some(campo => campo !== 'ativo')) throw new AuthError('Dados do cliente inválidos.');
  await mongoose.connection.transaction(async session => {
    const cliente = await User.findOneAndUpdate({
      _id: id,
      role: 'client'
    }, {
      $set: {
        ativo: dados.ativo
      }
    }, {
      session,
      returnDocument: 'after'
    });
    if (!cliente) throw new AuthError('Cliente não encontrado. Contas administrativas não podem ser alteradas aqui.', 404);
    if (!dados.ativo) await Session.updateMany({
      userId: id,
      revokedAt: null
    }, {
      $set: {
        revokedAt: new Date(),
        revokeReason: 'admin_revocation'
      }
    }, {
      session
    });
    await registrar(actorId, 'cliente.status', id, dados.ativo ? 'Conta ativada' : 'Conta desativada', session);
  });
  return {
    atualizado: true
  };
}
async function registrarDevolucaoEstoque(id, actorId) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new AuthError('Pedido não encontrado.', 404);
  await mongoose.connection.transaction(async session => {
    const pedido = await Order.findOne({
      _id: id,
      status: 'cancelado',
      estoqueControlado: true,
      estoqueRetornoPendente: true
    }).session(session);
    if (!pedido) throw new AuthError('Não existe devolução de estoque pendente para este pedido.', 409);
    await require('./storeInventoryService').movimentar(pedido, 'devolver', session);
    pedido.estoqueRetornoPendente = false;
    await pedido.save({
      session
    });
    await registrar(actorId, 'estoque.devolucao', id, 'Devolução física recebida e estoque reintegrado', session);
  });
  return detalhePedido(id);
}
module.exports = {
  filtros,
  resumo,
  listarPedidos,
  detalhePedido,
  listarPagamentos,
  listarClientes,
  alterarPedido,
  alterarCliente,
  registrar,
  registrarDevolucaoEstoque
};
