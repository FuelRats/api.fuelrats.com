var Rat, Rescue, User, RescueRats


Rat = require('../api/db').Rat
Rescue = require('../api/db').Rescue
RescueRats = require('../api/db').RescueRats
User = require('../api/db').User

Rescue.findAndCountAll({
  //attributes: [ 'id' ],
  where: {
    createdAt: {
      $lt: Date.parse('2015-11-01 00:00:00 +0000')
    }
  },
  include: [{
    model: Rat,
    as: 'rats',
    where: {},
    include:[{
      model: User,
      as: 'user',
      where:{}
    }]
  }]
}).then(function(results) {
  let res = results.rows.map(function (rescueInstance) {
    let rescue = rescueInstance.toJSON()
    let ratCount = rescue.rats.length;
    for(let i = 0; i < ratCount; i++) {
      let _r = rescue.rats[i].user
      User.update({ drilled: true }, { where: { id: _r.id } } )
    }

  })

  console.log(results.rows.length)
})