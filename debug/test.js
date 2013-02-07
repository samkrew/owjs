var owjs = require('../owjs');


client = new owjs.Client('192.168.56.1');

client.on('ready', function() {
	console.log('app is ready');
});

// client.send("/structure", owjs.OW_DIRALL, function(data) {
//     console.log(data);
// });

// async.parallel({
//     one: function(callback){
//     	callback(null, 1)
//     },
//     two: function(callback){
//         setTimeout(function(){
//             callback(null, 2);
//         }, 100);
//     }
// },
// function(err, results) {
// 	console.log(err)
// 	console.log(results)
//     // results is now equals to: {one: 1, two: 2}
// });