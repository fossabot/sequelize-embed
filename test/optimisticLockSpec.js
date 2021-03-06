
var { sequelize, models, sync, clear } = require('./common');
var Sequelize = sequelize.Sequelize;
var { Customer, Item, ItemType, Audit } = models;

var embed = require('../src/index')(sequelize);
var helpers = embed.util.helpers;
var mkIncludes = helpers.includes, mkInclude = helpers.include;


/* --- setup --- */

var LockedOrder = sequelize.define('LockedOrder', {
  name: Sequelize.STRING
}, {
  version: 'rev',
  timestamps: false
})

LockedOrder.Customer = LockedOrder.belongsTo(Customer, { as: 'customer' })

var include = mkIncludes(mkInclude(LockedOrder.Customer));
var opts = { reload: { include } };


/* --- tests --- */

describe('record with optimistic lock', () => {
  beforeEach(sync);

  var skipIfNoLocking = (f, done) => {
    if (!!sequelize.OptimisticLockError) f();
    else done();
  }

  it('should update even when no attributes have changed', done => {
    skipIfNoLocking(() =>
      Customer.create({ name: 'c1' }).then(c =>
        LockedOrder.create({ name: 'o1', rev: 0, customerId: c.id }).then(o =>
          embed.update(LockedOrder, { id: o.id, rev: 0, customer: { id: c.id, name: 'c1.1' } }, include, opts)
            .then(result => {
              expect(result.rev).toBe(1);
              expect(result.name).toBe('o1');
              expect(result.customer.name).toBe('c1.1');
              done();
            }))), done);
  });

  it('should rollback associated updates when conflict occurs', done => {
    skipIfNoLocking(() =>
      Customer.create({ name: 'c1' }).then(c =>
        LockedOrder.create({ name: 'o1', rev: 1, customerId: c.id }).then(o =>
          embed.update(LockedOrder, { id: o.id, name: 'o1.1', rev: 0, customer: { id: c.id, name: 'c1.1' } }, include, opts)
            .catch(sequelize.OptimisticLockError, err => {
              LockedOrder.findById(c.id, { include }).then(result => {
                expect(result.rev).toBe(1);
                expect(result.name).toBe('o1');
                expect(result.customer.name).toBe('c1');
                done();
              });
            }))), done);
  });

});


