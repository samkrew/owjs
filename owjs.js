// based on https://github.com/benediktarnold/owfs

var events = require('events');
var util = require('util');
var net = require('net');
var async = require('async');

var OW_READ =   2; // read from 1-wire bus
var OW_WRITE =  3; // write to 1-wire bus
var OW_DIR =    4; // list 1-wire bus
var OW_PRESENT = 6; // Is the specified component recognized and known
var OW_DIRALL = 7; // list 1-wire bus, in one packet string
var OW_GET =    8; // dirall or read depending on path
var OW_DIRALLSLASH = 9; // dirall but with directory entries getting a trailing '/'
var OW_GETSLASH = 10; // dirallslash or read depending on path


function Client(options) {
    var self = this;

    self.headers = ['version', 'payload', 'ret', 'controlflags', 'size', 'offset'];

    self.devices = {};

    self.option = {
        host: 'localhost',
        port: 4304,
        // cache: {
        //     volatile: 15,   // sensors
        //     stable: 300,    // switches, flush on write
        //     directory: 60,  // sensor list
        //     presence: 120,  // device location
        // },
        // timeouts: {
        //     volatile:   60,
        //     stable:     60,
        //     directory:  5,
        // },
        timeouts: {
            device:     0,
            directory:  0,
        }
    }

// set options
    for(var i in options) {
        if(typeof(options[i]) == 'object') {
            self.option[i] = {};
            for(var j in options[i]) {
                self.option[i][j] = options[i][j];
            }
        } else {
            self.option[i] = options[i];
        }
    }

// define procedures
    self.htonl = function(n) {
        return [
            (n & 0xFF000000) >>> 24,
            (n & 0x00FF0000) >>> 16,
            (n & 0x0000FF00) >>>  8,
            (n & 0x000000FF) >>>  0,
        ];
    }

    self.ntohl = function(b) {
      return ((0xff & b[0]) << 24) |
             ((0xff & b[1]) << 16) |
             ((0xff & b[2]) << 8) |
             ((0xff & b[3]));
    }

    // send raw data to 1-wire and return result
    self.send = function(path, value, type, callback) {
        var socket = new net.Socket({ type: 'tcp4' });
        var messages = [];

        socket.on('error', function(error) {
            throw new Error(error);
        });

        socket.on('end', function() {
            callback(messages);
        });

        socket.on('data', function (data) {
            var j=0, chunk = 4, header ={};
            for (var i=0; i<24; i+=chunk) {
                var temparray = data.slice(i,i+chunk);
                var value = self.ntohl(temparray);
                header[self.headers[j]] = value;
                j++;
            }
            messages.push({
                header: header,
                payload: data.slice(24).toString('utf8')
            });
        });

        socket.connect(self.option.port, self.option.host, function() {
            var msg = [];
            path += '\x00';
            value = (type == OW_WRITE) ? value.toString() + '\x00' : '' ;
            // http://owfs.org/index.php?page=owserver-message-types
            msg = msg.concat(
                self.htonl(0),
                self.htonl(path.length + value.length),
                self.htonl(type),
                self.htonl(0x00000020),
                self.htonl(value.length ? value.length : 8192),
                self.htonl(0)
            );
            var buf = new Buffer(msg.length + path.length + value.length);
            new Buffer(msg).copy(buf, 0);
            new Buffer(path + value).copy(buf, msg.length);

            socket.end(buf);
        });
    }

    // return array of dir
    self.list = function(path, callback) {
        self.send(path, null, OW_DIRALL, function(data) {
            if(data[0].header.ret < 0) return self.emit('error', data[0].header.ret);
            var str = data[0].payload;
            str = str.substring(0, str.length - 1); // remove zero-char from end
            callback(str.split(','));
        });
    }

    // read value
    self.read = function(path, callback) {
        self.send(path, null, OW_READ, function(data) {
            if(data[0].header.ret < 0) return self.emit('error', data[0].header.ret);
            callback(data[0].payload);
        });
    }

    // write value
    self.write = function(path, value, callback) {
        self.send(path, value, OW_WRITE, function(data) {
            if(data[0].header.ret < 0) return self.emit('error', data[0].header.ret);
            callback();
        });
    }

    self.requestDevices = function(callback) {
        self.list('/uncached',
            function(data) {
                var newdev = {};

                for(var i=0; i < data.length; i++) {
                    var name = data[i].substr(10);
                    if(!self.devices[name]) { // device not exists
                        self.devices[name] = new Device({
                            name:   name,
                            interval: self.option.timeouts.device
                        });
                        self.emit('device-enabled', self.devices[name]);
                    }
                    newdev[name] = name;
                }
                // check for dead devices
                for(var name in self.devices)
                    if(!newdev[name]) {
                        delete self.devices[name];
                        self.emit('device-disabled', name);
                    }
                if(callback) callback();
            }
        );
    }

    self.setDirInterval = function(interval) {
        self.option.timeouts.directory = interval;

        if(!self.option.timeouts.directory) return;
        self.requestDevices();
        setTimeout(function() {
            self.requestDevices();
            setTimeout(arguments.callee, self.option.timeouts.directory * 1000);
        }, self.option.timeouts.directory * 1000);
    }

    self.init = function(callback) {

        if(self.option.timeouts.directory)
            self.setDirInterval(self.option.timeouts.directory);

         self.requestDevices(function() {
            callback();
         })

    }

}

var Device = function(params) {

    var name = params.name;
    var interval = params.interval;

    this.devices = {'10': 'switch', '05': 'temp'}

    this.device_switch = function() {
        this.data = function() {
            return 'switch';
        }
    }

    this.device_temp = function() {
        this.data = function() {
            return 'temp';
        }
    }

    this.device_unknown  = function() {
        this.data = function() {
            return 'unknown';
        }
    }

    var arr = name.split('.');
    var cls = 'device_' +(this.devices[arr[0]]?this.devices[arr[0]]:'unknown');
    return new this[cls];
}

util.inherits(Client, events.EventEmitter);
exports.Client = Client;
