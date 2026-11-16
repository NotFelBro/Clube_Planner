const Counter = require('../models/catalogCounter');
async function proximoId(session) {
  await Counter.updateOne({
    _id: 'vitrine'
  }, {
    $max: {
      sequencia: 12
    }
  }, {
    upsert: true,
    session
  });
  const contador = await Counter.findOneAndUpdate({
    _id: 'vitrine'
  }, {
    $inc: {
      sequencia: 1
    }
  }, {
    returnDocument: 'after',
    session
  });
  return contador.sequencia;
}
module.exports = {
  proximoId
};
