var owjs = require('../owjs');


client = new owjs.Client({
	host: '192.168.56.1'
});




// basic usage

client.list('/', function(res) {
	console.log('Array of devices:')
	console.log(res);
}, function(errcode) {
	console.log('1-wire error while listing dir, code '+errcode);
});

client.read('/settings/timeout/directory', function(value) {
	console.log('Timeout value: '+value)
}, function(errcode) {
	console.log('1-wire error while reading value, code '+errcode);
});

client.write('/05.4AEC29CDBAAB/PIO', 100, function() {
	console.log('Trigger switched')
}, function(errcode) {
	console.log('1-wire error while writting value, code '+errcode);
});


client.send('/', null, 7, function(res) {
	console.log(res);
});
