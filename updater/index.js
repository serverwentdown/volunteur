var async = require("async");
var colours = require("colors");
var geolib = require("geolib");

var redis = require("redis");
var eventsClient = redis.createClient({
  host : 'redis',
  db : 2
});
var usersClient = redis.createClient({
  host : 'redis',
  db : 0
});

var update = function(){
  setTimeout(update, 60 * 1000); //Run a new function every minute
  eventsClient.lrange('_events', 0, -1, function(err, keys){
    var now = Date.now();
    async.each(keys, function(key, cb){
      //Check if the event is over
      eventsClient.hget(key, 'endtime', function(get_err, endtime){
        if(now > endtime){ //If it is past the event's end
          //Archive the event
          //TODO: archiving stuff
          cb();
        }else{
          //Check if an hour has passed
          eventsClient.hget(key, 'counter', function(count_err, count){
            if(count == 0){ //Hours turns on the 0
              //Check if the event has started
              eventsClient.hget(key, 'starttime', function(getstart_err, starttime){
                if(starttime < now){
                  console.log('Updating score for ' + key);
                  //Check for presence of geolocation data
                  eventsClient.hmget(key, 'lat', 'lng', 'size', function(getgeo_err, geodata){
                    if(geodata[0] && geodata[1] && geodata[2]){
                      //If there exists geolocation data
                      var participants = JSON.parse(raw_participants);
                      async.each(participants, function(participant, cb2){
                        if(participant.lat && participant.lng){
                          if(geolib.getDistance({latitude : lat, longitude : lng}, {latitude : participant.lat, longitude : participant.lng}, 10) <= size){
                            usersClient.hincrby(participant, 'score', 1);
                          }
                        }else{
                          usersClient.hincrby(participant, 'score', 1);
                        }
                        cb2();
                      }, () => {});
                    }else{
                      eventsClient.hget(key, 'participants', function(getpar_err, raw_participants){
                        var participants = JSON.parse(raw_participants);
                        async.each(participants, function(participant, cb2){
                          usersClient.hincrby(participant, 'score', 1);
                          cb2();
                        }, () => {});
                      });
                    }
                  });
                }
              });
            }
            //Increment counters in event
            count >= 2 ? eventsClient.hset(key, 'counter', 0) : eventsClient.hincrby(key, 'counter', 1);
            cb();
          });
        }
      });
    });
  });
}

update();

console.log("Updater service is running.".green);
