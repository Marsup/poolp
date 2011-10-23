var _ = require('underscore'),
    async = require('async');

var Poolp = module.exports = function Poolp(factory, options) {
  if(!(this instanceof Poolp)) return new Poolp(factory, options);
  
  if(typeof factory !== 'function') throw new Error('You must provide a factory to create objects.');
  
  var self = this, destroy;
  options = options || {};

  // Pick custom options or leave the default ones.
  self.maxObjects = ~~options.maxObjects || self.maxObjects; 
  self.maxTTL = options.maxTTL || self.maxTTL;
  destroy = options.destroy || function() {};

  // Check that we can work with the current options.
  if(self.maxObjects < 1) throw new Error('The maxObjects option must be a number of at least 1.');
  if(typeof self.maxTTL !== 'number') throw new Error('The maxTTL option must be a number.');
  if(typeof destroy !== 'function') throw new Error('Destroy must be a function.');
  
  // Array of objects that will be available for work.
  self.objects= [];
  
  // Queue that will manage the objects and restrict their number.
  self.queue = async.queue(function createObject(task, freeObj) {
    var options = task[0], callback = task[1];
    
    // Attempt to create a new object.
    factory(options, function(err, obj) {
      // We have failed to create the object, remove this one from the queue.
      if(err) return freeObj(callback(err));
      
      // The object has been created, give it means to receive tasks to do.
      var objectHolder = {
        options: options,
        taskQueue: async.queue(function runTask(task, release) {
          return task(null, obj, release);
        }, 1),
        forgetObject: function() {
          // We have reached the expiry, forget the object.
          self.objects.splice(self.objects.indexOf(objectHolder), 1);
          return freeObj(destroy(obj));
        }
      };
      
      // Trigger a timeout everytime the task queue is empty.
      objectHolder.taskQueue.drain = function emptyQueue() {
        objectHolder.idleTimeout = setTimeout(objectHolder.forgetObject, self.maxTTL);
      };
      
      self.objects.push(objectHolder);
      objectHolder.taskQueue.push(callback);
    });
  }, self.maxObjects);
};

// Maximum 5 simultaneous objects by default.
Poolp.prototype.maxObjects = 5;

// 30 seconds as default TTL.
Poolp.prototype.maxTTL = 30000;

Poolp.prototype.take = function take(options, callback) {
  if(typeof callback !== 'function') {
    throw new Error('The callback must be a function');
  }
  
  // Find an existing object matching the options.
  var selectedObject, nbObjects = this.objects.length, it = 0;
  while(!selectedObject && it < nbObjects) {
    selectedObject = this.objects[it++];
    if(!_.isEqual(selectedObject.options, options)) {
      selectedObject = null;
    }
  }
  
  if(selectedObject) {
    // Clear any idle timer pending.
    if(selectedObject.idleTimeout) clearTimeout(selectedObject.idleTimeout);
    
    // Add the task and launch the work.
    return selectedObject.taskQueue.push(callback);
  }
  
  // No available object to process our request right now, push it to the queue,
  // it will eventually create a new object if there is room, or wait for another
  // object to die.
  return this.queue.push([options, callback]);
};

Poolp.prototype.tearDown = function() {
  var self = this;
  
  // Replace the take function to report the tear down nicely.
  self.take = function(options, callback) {
    if(typeof callback !== 'function') {
      throw new Error('The callback must be a function');
    }
    
    return callback(new Error('The pool is being torn down.'));
  };
  
  // Set TTL to 0 so that existing objects will die as they finish their work.
  self.maxTTL = 0;
  
  // Get rid of the ones that are currently in idle state.
  self.objects.forEach(function(obj) {
    if(obj.idleTimeout) {
      clearTimeout(obj.idleTimeout);
      obj.forgetObject();
    }
  });
};
