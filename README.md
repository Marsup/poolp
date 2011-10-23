Poolp -- a parameterized pool of objects
========================================

# Summary

Poolp is a basic pool library that will help you manage often reused objects while limiting their concurrent use.

It allows you to define how many different objects can live at the same time, and how long they should live without being used.

# Example

```javascript
var pool = new Poolp(function workerFactory(options, callback) {
  if(typeof options !== 'object') {
    return callback(new Error('Bad options !'));
  }
  var myObj = new worker(options);
  callback(null, myObj);
});

pool.take({ my: { worker: { options: 'w00t' }}}, 
function(err, myWorker, release) {
  if(err) return console.log('Oops, the creation of my worker failed !');
  myWorker.doWork(function() {
    console.log('My work is done, release the object for another worker !');
    release();
  });
});
```

# Usage

## new Poolp(factory, options)

Create a new pool.

* **factory(options, callback)**: A function to create new objects.
  * **options**: Options that should help you create your custom object, it's coming directly from the `take` function.
  * **callback(err, obj)**: This must be called once your object is created or if an error occurred.
* **options**: An optional object containing your settings.
  * **maxObjects**: Maximum number of objects to have at a time. (default: 5)
  * **maxTTL**: Maximum time an object can spend idling before it is destroyed. (default: 30s)
  * **destroy**: Function called when an object is being retired from the queue.

## pool.take(options, callback)

Ask the pool for an object built with the specified options.

* **options**: It can be just anything. It will be provided as is to the `factory`, and will be used to look for existing objects in the queue.
* **callback(err, object, release)**: It will be called when the queue is ready to give you an answer.
  * **err**: If your factory provides an error, you will find it here.
  * **object**: The object provided by your factory.
  * **release**: A function to tell the queue you are done with the object and it is available again for another `take`.

## pool.tearDown()

By calling this, the pool will stop providing you with new or existing objects.
The current objects handled by the pool will finish their work if needed, and be destroyed.

# Credits

Special thanks to :

  * @caolan for [async](https://github.com/caolan/async)
  * @documentcloud for [underscore](https://github.com/documentcloud/underscore)
