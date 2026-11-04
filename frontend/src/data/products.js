
export const products = [
  {
    id: 1,
    name: "Planner Semanal",
    description: "Planejamento sem complicação",
    detailDescription:
      "Organize seus dias com leveza e criatividade.",
    price: 49.9,
    discount: 25,
    coupon: true,
    category: "planners",
    categoryName: "Planners & agendas",
    model: "Semanal",
    material: "A confirmar",
    stock: null,
    color: "#81B29A",
    background: "#E8F1E8",
    illustration: "PLANNER",
    illustrationSubtitle: "SEMANAL",
  },
  {
    id: 2,
    name: "Caderno Pontilhado",
    description: "Espaço para todas as ideias",
    detailDescription:
      "Um espaço especial para registrar ideias, planos e inspirações.",
    price: 34.9,
    discount: 25,
    coupon: true,
    category: "cadernos",
    categoryName: "Cadernos & blocos",
    model: "Pontilhado",
    material: "A confirmar",
    stock: null,
    color: "#E7A995",
    background: "#FAE7DE",
    illustration: "CADERNO",
    illustrationSubtitle: "PONTILHADO",
  },
  {
    id: 3,
    name: "Kit de Canetas Pastel",
    description: "Cor para sua rotina",
    detailDescription:
      "Adicione delicadeza e criatividade às suas anotações.",
    price: 27.9,
    discount: 25,
    coupon: true,
    category: "canetas",
    categoryName: "Canetas & acessórios",
    model: "Kit pastel",
    material: "A confirmar",
    stock: null,
    color: "#A5AECF",
    background: "#E8EBF5",
    illustration: "CANETAS",
    illustrationSubtitle: "PASTEL",
  },
  {
    id: 4,
    name: "Bloco de Notas",
    description: "Pequenas listas, grandes planos",
    detailDescription:
      "Registre lembretes e organize suas tarefas do dia a dia.",
    price: 19.9,
    discount: 25,
    coupon: true,
    category: "cadernos",
    categoryName: "Cadernos & blocos",
    model: "Bloco de notas",
    material: "A confirmar",
    stock: null,
    color: "#D7BF76",
    background: "#FAF1D3",
    illustration: "BLOCO",
    illustrationSubtitle: "DE NOTAS",
  },
];

export function getProductById(id) {
  return products.find(
    (product) => product.id === Number(id)
  );
}

export function formatPrice(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
