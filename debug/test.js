var owjs = require('../owjs');


client = new owjs.Client({
	host: '192.168.56.1',
});

client.on('error', function(errcode) {
	throw new Error('1-wire error, code '+errcode);
});

// value changed
client.on('data-change', function() {
	console.log('Data changed on device');
});

client.on('device-enabled', function() {
	console.log('New device appeared in system');
});

client.on('device-disabled', function() {
	console.log('Device disappeared from system');
});


client.init(function() {

	for(var i in client.devices)
		console.log(client.devices[i].data());
});

// client.list(
// 	'/10.67C6697351FF',
// 	function(data) {
// 		console.log('\nFiles in directory:');
// 		for(var i=0; i < data.length; i++)
// 			console.log(data[i]);
// 	}
// );

// client.read(
// 	'/05.000005FA0100/PIO',
// 	function(data) {
// 		console.log('\nValue:');
// 		console.log(data);
// 	}
// );

// client.write(
// 	'/05.000005FA0100/PIO',
// 	'1',
// 	function() {
// 		console.log('\nValue written');
// 	}
// );

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