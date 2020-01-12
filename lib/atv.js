'use strict';

require("babel-polyfill")

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var crypto = require('crypto');
var fs = require('fs');

var bplistCreator = require('bplist-creator');
var bplistParser = require('bplist-parser');

var SRP = require('./srp');
var ATVAuthenticator = require('./atvAuthenticator');
var httpClientFactory = require('./http');

// ...
// Configuration.
var loadConfig = function loadConfig(configFilePath) {
    return !fs.existsSync(configFilePath) ? null : JSON.parse(fs.readFileSync(configFilePath));
};
var saveConfig = function saveConfig(configFilePath, config) {
    return fs.writeFileSync(configFilePath, JSON.stringify(config, null, '\t'));
};

// ...

var ATV = function () {
    function ATV(addr, port) {
        _classCallCheck(this, ATV);

        this.addr = addr;
        this.port = port || 7000;

        this.httpClient = httpClientFactory();
    }

    // ...

    _createClass(ATV, [{
        key: 'auth',
        value: function auth(configFilePath, authenticator) {
            var auth = function () {
                var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(owner) {
                    var conf, srp, I, P, s, B, a, A, M1, verifier;
                    return regeneratorRuntime.wrap(function _callee$(_context) {
                        while (1) {
                            switch (_context.prev = _context.next) {
                                case 0:
                                    _context.next = 2;
                                    return owner.httpClient.connect(owner.addr, owner.port);

                                case 2:
                                    conf = loadConfig(configFilePath);

                                    if (!(!conf || !conf['auth_secret'])) {
                                        _context.next = 14;
                                        break;
                                    }

                                    // a pairing does not exist and must be performed.

                                    // ...
                                    // SRP parameters. 
                                    srp = new SRP(2048);
                                    I = '366B4165DD64AD3A';
                                    P = void 0;
                                    s = void 0;
                                    B = void 0;
                                    a = void 0;
                                    A = void 0;
                                    M1 = void 0;
                                    _context.next = 14;
                                    return owner.httpClient.request('POST', '/pair-pin-start').then(function () {
                                        return authenticator();
                                    }).then(function (pin) {
                                        P = pin;

                                        return owner.httpClient.request('POST', '/pair-setup-pin', {
                                            'Content-Type': 'application/x-apple-binary-plist'
                                        }, bplistCreator({
                                            user: '366B4165DD64AD3A',
                                            method: 'pin'
                                        }));
                                    }).then(function (res) {
                                        var _bplistParser$parseBu = bplistParser.parseBuffer(res.body)[0],
                                            pk = _bplistParser$parseBu.pk,
                                            salt = _bplistParser$parseBu.salt;


                                        s = salt.toString('hex');
                                        B = pk.toString('hex');

                                        // SRP: Generate random auth_secret, 'a'; if pairing is successful, it'll be utilized in 
                                        // subsequent session authentication(s).
                                        a = crypto.randomBytes(32).toString('hex');

                                        // SRP: Compute A and M1. 
                                        A = srp.A(a);
                                        M1 = srp.M1(I, P, s, a, B);

                                        return owner.httpClient.request('POST', '/pair-setup-pin', {
                                            'Content-Type': 'application/x-apple-binary-plist'
                                        }, bplistCreator({
                                            pk: Buffer.from(A, 'hex'),
                                            proof: Buffer.from(M1, 'hex')
                                        }));
                                    }).then(function () {
                                        // confirm the auth secret (a).
                                        var _ATVAuthenticator$con = ATVAuthenticator.confirm(a, srp.K(I, P, s, a, B)),
                                            epk = _ATVAuthenticator$con.epk,
                                            authTag = _ATVAuthenticator$con.authTag;

                                        // complete pair-setup-pin by registering the auth secret with the target device.

                                        return owner.httpClient.request('POST', '/pair-setup-pin', {
                                            'Content-Type': 'application/x-apple-binary-plist'
                                        }, bplistCreator({
                                            epk: Buffer.from(epk, 'hex'),
                                            authTag: Buffer.from(authTag, 'hex')
                                        }));
                                    }).then(function () {
                                        // save the auth secret for subsequent session authentication(s).
                                        !conf && (conf = {});
                                        conf['auth_secret'] = a;
                                        saveConfig(configFilePath, conf);
                                    });

                                case 14:

                                    // ...
                                    // Authenticate session with the target device using existing pairing information.
                                    verifier = ATVAuthenticator.verifier(conf['auth_secret']);

                                    return _context.abrupt('return', owner.httpClient.request('POST', '/pair-verify', {
                                        'Content-Type': 'application/octet-stream'
                                    }, verifier.verifierBody).then(function (res) {
                                        var atv_pub = res.body.slice(0, 32).toString('hex');
                                        var atv_data = res.body.slice(32).toString('hex');

                                        var shared = ATVAuthenticator.shared(verifier.v_pri, atv_pub);
                                        var signed = ATVAuthenticator.signed(conf['auth_secret'], verifier.v_pub, atv_pub);
                                        var signature = Buffer.from(Buffer.from([0x00, 0x00, 0x00, 0x00]).toString('hex') + ATVAuthenticator.signature(shared, atv_data, signed), 'hex');

                                        return owner.httpClient.request('POST', '/pair-verify', {
                                            'Content-Type': 'application/octet-stream'
                                        }, signature);
                                    }));

                                case 17:
                                case 'end':
                                    return _context.stop();
                            }
                        }
                    }, _callee, this);
                }));

                return function auth(_x) {
                    return _ref.apply(this, arguments);
                };
            }();

            ;

            return auth(this);
        }
    }, {
        key: 'play',
        value: function play(videoUrl) {
            return this.httpClient.request('POST', '/play', {
                'Content-Type': 'application/x-apple-binary-plist'
            }, bplistCreator({
                'Content-Location': videoUrl,
                'Start-Location': 0
            }));
        }
    }, {
        key: 'stop',
        value: function stop() {
            return this.httpClient.request('POST', '/stop');
        }
    }, {
        key: 'scrub',
        value: function scrub(position) {
            return this.httpClient.request('POST', '/scrub?position=' + position); // float, seconds
        }
    }, {
        key: 'close',
        value: function close() {
            this.httpClient.close();
        }
    }, {
        key: 'rate',
        value: function rate(newValue) {
            return this.httpClient.request('POST', '/rate?value=' + newValue); // 0 pause, 1 resume
        }
    }, {
        key: 'playbackInfo',
        value: function playbackInfo(cb) {
            this.httpClient.request('GET', '/playback-info').then(function(res) {
                cb && cb(res)
            });
        }
    }]);

    return ATV;
}();

// ...

module.exports = ATV;
