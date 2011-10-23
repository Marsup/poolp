var assert = require('assert'),
    vows = require('vows'),
    gleak = require('gleak')(),
    Poolp = require('../');

var created = 0, destroyed = 0;

vows.describe('Basic Poolp tests').addBatch({
  'considering a pool that does parameterized additions': {
    topic: function() {
      var pool = new Poolp(function workerFactory(options, callback) {
        if(typeof options !== 'number') {
          return callback(new Error('Not a number'));
        }
        
        created++;
        
        var worker = function(n) { return n + options; };
        
        return callback(null, worker);
      }, {
        maxTTL: 10, // Expire fast for the tests
        destroy: function(obj) {
          if(!obj) throw new Error('Destroy has been given an undefined object !');
          destroyed++;
        }
      });
      return pool;
    },
    'when I ask the pool for an object that adds 5': {
      topic: function(pool) {
        pool.take(5, this.callback.bind(this, null));
      },
      'and I give 7': {
        topic: function(err, adder, release) {
          var result = adder(7);
          release();
          return result;
        },
        'I should get 12': function(result) {
          assert.strictEqual(result, 12);
        }
      }
    },
    'when I ask the pool for many objects that adds 42': {
      topic: function(pool) {
        var self = this, numberOfTakers = 20, total = 0,
            actualTakers = 0, expectedTakers = numberOfTakers;
        var addToTotal = function(err, adder, release) {
          total += adder(0); // Add nothing
          release();
          if(++actualTakers == expectedTakers) return self.callback(null, total);
        };
        while(numberOfTakers--) {
          pool.take(42, addToTotal);
        }
      },
      'I should get 840': function(err, result) {
        assert.strictEqual(result, 840);
      }
    },
    'when I ask the pool for many objects that adds random integers': {
      topic: function(pool) {
        var self = this, numberOfTakers = 50, total = 0, rand, expected = 0,
            actualTakers = 0, expectedTakers = numberOfTakers;
        var addToTotal = function(err, adder, release) {
          total += adder(0); // Add nothing
          release();
          if(++actualTakers == expectedTakers) return self.callback(null, total, expected);
        };
        while(numberOfTakers--) {
          rand = ~~(Math.random()*101);
          expected += rand;
          pool.take(rand, addToTotal);
        }
      },
      'I should get the correct result': function(err, actual, expected) {
        assert.strictEqual(actual, expected);
      }
    },
    'when I ask the pool for objects with a wrong argument': {
      topic: function(pool) {
        pool.take('invalidArg', this.callback.bind(this, null));
      },
      'I should get an error': function(_, err) {
        assert.ok(err);
        assert.isTrue(err instanceof Error);
      }
    },
    'when I ask the pool for objects that adds 1 and tear down the pool': {
      topic: function(pool) {
        var self = this, numberOfTakers = 20, total = 0, error,
            actualTakers = 0, expectedTakers = numberOfTakers;
        var addToTotal = function(err, adder, release) {
          total += adder(0); // Add nothing
          release();
          if(++actualTakers == expectedTakers) {
            // Wait for the next tick to shoot the callback if we want the queue to be really purged.
            process.nextTick(function() {
              return self.callback(null, total, error);
            });
          }
        };
        while(numberOfTakers--) {
          pool.take(1, addToTotal);
        }
        
        pool.tearDown();
        pool.take(1, function(err) {
          error = err;
        });
      },
      'I should get 20 and an error': function(err, result, error) {
        assert.strictEqual(result, 20);
        assert.ok(error);
        assert.isTrue(error instanceof Error);
      }
    }
  }
})
.addBatch({
  'when I check for the number of created and destroyed objects': {
    topic: function() {
      this.callback(null, created, destroyed);
    },
    'I should have cleaned everything': function(_, created, destroyed) {
      assert.strictEqual(created, destroyed);
    }
  }
})
.addBatch({
  'when I check for leaked globals': {
    topic: function() {
      gleak.ignore(buffer); // Ignore buffer until vows fixes it.
      return gleak.detect();
    },
    'there should be no leak': function(leaks) {
      assert.strictEqual(leaks.length, 0, 'Leaks:'+JSON.stringify(leaks));
    }
  }
})
.export(module);
