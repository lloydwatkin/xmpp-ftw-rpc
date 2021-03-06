'use strict';

/* jshint -W030 */

var should = require('should')
  , Rpc = require('../../index')
  , ltx    = require('ltx')
  , helper = require('../helper')

describe('Rpc', function() {

    var rpc, socket, xmpp, manager

    before(function() {
        socket = new helper.SocketEventer()
        xmpp = new helper.XmppEventer()
        manager = {
            socket: socket,
            client: xmpp,
            trackId: function(id, callback) {
                if (typeof id !== 'object')
                    throw new Error('Stanza ID spoofing not implemented!')
                this.callback = callback
            },
            makeCallback: function(error, data) {
                this.callback(error, data)
            },
            _getLogger: function() {
                return {
                    log: function() {},
                    error: function() {},
                    warn: function() {},
                    info: function() {}
                }
            }
        }
        rpc = new Rpc()
        rpc.init(manager)
    })

    beforeEach(function() {
        socket.removeAllListeners()
        xmpp.removeAllListeners()
        rpc.init(manager)
    })

    describe('Handles', function() {

        it('Returns false by default', function() {
            rpc.handles(helper.getStanza('rpc-set')).should.be.true
        })

        it('Returns true for RPC calls', function() {
            rpc.handles(ltx.parse('<iq/>')).should.be.false
        })

    })

    describe('Can make RPCs', function() {

        it('Errors if no callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing callback')
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.send('xmpp.rpc.perform', {})
        })

        it('Errors if non-functional callback provided', function(done) {
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            socket.once('xmpp.error.client', function(error) {
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing callback')
                error.request.should.eql({})
                xmpp.removeAllListeners('stanza')
                done()
            })
            socket.send('xmpp.rpc.perform', {}, true)
        })

        it('Errors if no \'to\' key provided', function(done) {
            var request = {}
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'to\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Errors if no \'method\' key provided', function(done) {
            var request = {
                to: 'rpc.server.com'
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Missing \'method\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Sends expected stanza with no params', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction'
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.id.should.exist
                stanza.attrs.to.should.equal(request.to)
                stanza.attrs.type.should.equal('set')
                var query = stanza.getChild('query', rpc.NS)
                query.should.exist
                query.getChild('methodCall').getChildText('methodName')
                    .should.equal(request.method)
                done()
            })
            socket.send(
                'xmpp.rpc.perform',
                request,
                function() {}
            )
        })

        it('Errors if \'params\' is not an array', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction',
                params: true
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('\'params\' must be an array')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Errors if any param doesn\'t have type', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction',
                params: [{}]
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('\'param\' must have \'type\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Errors if any param doesn\'t have a value', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction',
                params: [{ type: 'int' }]
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, success) {
                should.not.exist(success)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('\'param\' must have \'value\' key')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Sends expected stanza with basic param types', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction',
                params: [
                    { type: 'i4', value: 'i4value' },
                    { type: 'int', value: 'intvalue' },
                    { type: 'string', value: 'stringvalue' },
                    { type: 'double', value: 'double' },
                    { type: 'base64', value: '34332354f3fve2' },
                    { type: 'boolean', value: true },
                    { type: 'dateTime.iso8601', value: '2013-10-01Z10:10:10T' }
                ]
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.id.should.exist
                stanza.attrs.to.should.equal(request.to)
                stanza.attrs.type.should.equal('set')
                var methodCall = stanza.getChild('query', rpc.NS)
                    .getChild('methodCall')
                methodCall.should.exist
                var paramsParent = methodCall.getChild('params')
                paramsParent.should.exist
                var params = paramsParent.getChildren('param')
                params.length.should.equal(request.params.length)
                for (var i = 0; i < request.params.length; ++i)
                    params[i].getChild('value')
                        .getChildText(request.params[i].type)
                        .should.equal(request.params[i].value)
                done()
            })
            socket.send(
                'xmpp.rpc.perform',
                request,
                function() {}
            )
        })

        it('Sends expected stanza with array param type', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction',
                params: [
                    {
                        type: 'array',
                        value: [
                            { type: 'string', value: 'one' },
                            { type: 'int', value: 2 }
                        ]
                    }
                ]
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.id.should.exist
                stanza.attrs.to.should.equal(request.to)
                stanza.attrs.type.should.equal('set')
                var methodCall = stanza.getChild('query', rpc.NS)
                    .getChild('methodCall')
                methodCall.should.exist
                var params = methodCall.getChild('params')
                params.should.exist
                var param = params.getChild('param')
                var data = param.getChild('value').getChild('array')
                    .getChild('data')
                    .getChildren('value')
                data.length.should.equal(2)

                data[0].getChildText('string').should.equal('one')
                data[1].getChildText('int').should.equal('2')
                done()
            })
            socket.send(
                'xmpp.rpc.perform',
                request,
                function() {}
            )
        })

        it('Can handle nested arrays', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction',
                params: [
                    {
                        type: 'array',
                        value: [{
                            type: 'array',
                            value: [
                                { type: 'int', value: 2 }
                            ]
                        }]
                    }
                ]
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.id.should.exist
                stanza.attrs.to.should.equal(request.to)
                stanza.attrs.type.should.equal('set')
                var methodCall = stanza.getChild('query', rpc.NS)
                    .getChild('methodCall')
                methodCall.should.exist
                var params = methodCall.getChild('params')
                params.should.exist
                var param = params.getChild('param')
                var data = param.getChild('value')
                    .getChild('array')
                    .getChild('data')
                    .getChild('value')
                data.should.exist
                var childArray = data.getChild('array')
                var childData = childArray.getChild('data').getChild('value')
                childData.getChildText('int')
                    .should.equal('2')
                done()
            })
            socket.send(
                'xmpp.rpc.perform',
                request,
                function() {}
            )
        })

        it('Badly formatted array parameter return error', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction',
                params: [
                    {
                        type: 'array',
                        value: true
                    }
                ]
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, data) {
                should.not.exist(data)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Parameter formatting error')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Sends expected stanza with struct param type', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction',
                params: [
                    {
                        type: 'struct',
                        value: [
                            { type: 'string', value: 'one', name: 'PageNumber' },
                            { type: 'int', value: 2, name: 'RPP' }
                        ]
                    }
                ]
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.id.should.exist
                stanza.attrs.to.should.equal(request.to)
                stanza.attrs.type.should.equal('set')
                var methodCall = stanza.getChild('query', rpc.NS)
                    .getChild('methodCall')
                methodCall.should.exist
                var params = methodCall.getChild('params')
                params.should.exist
                var param = params.getChild('param')
                var members = param.getChild('value')
                    .getChild('struct')
                    .getChildren('member')
                members.length.should.equal(2)

                members[0].getChildText('name').should.equal('PageNumber')
                members[0].getChild('value').getChildText('string').should.equal('one')

                members[1].getChildText('name').should.equal('RPP')
                members[1].getChild('value').getChildText('int').should.equal('2')
                done()
            })
            socket.send(
                'xmpp.rpc.perform',
                request,
                function() {}
            )
        })

        it('Can handle nested structs', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction',
                params: [
                    {
                        type: 'struct',
                        value: [{
                            type: 'struct',
                            value: [
                                { type: 'int', value: 2, name: 'PageNumber' }
                            ],
                            name: 'Paging'
                        }]
                    }
                ]
            }
            xmpp.once('stanza', function(stanza) {
                stanza.is('iq').should.be.true
                stanza.attrs.id.should.exist
                stanza.attrs.to.should.equal(request.to)
                stanza.attrs.type.should.equal('set')
                var methodCall = stanza.getChild('query', rpc.NS)
                    .getChild('methodCall')
                methodCall.should.exist
                var params = methodCall.getChild('params')
                params.should.exist
                var param = params.getChild('param')
                var member = param.getChild('value')
                    .getChild('struct')
                    .getChild('member')
                member.should.exist
                member.getChildText('name').should.equal('Paging')
                var childStruct = member.getChild('value').getChild('struct')
                var childMember = childStruct.getChild('member')
                childMember.getChildText('name').should.equal('PageNumber')
                childMember.getChild('value').getChildText('int')
                    .should.equal('2')
                done()
            })
            socket.send(
                'xmpp.rpc.perform',
                request,
                function() {}
            )
        })

        it('Badly formatted struct parameter return error', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction',
                params: [
                    {
                        type: 'struct',
                        value: true
                    }
                ]
            }
            xmpp.once('stanza', function() {
                done('Unexpected outgoing stanza')
            })
            var callback = function(error, data) {
                should.not.exist(data)
                error.type.should.equal('modify')
                error.condition.should.equal('client-error')
                error.description.should.equal('Parameter formatting error')
                error.request.should.eql(request)
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

    })

    describe('RPC responses', function() {

        it('Can handle error responses', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction'
            }
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('rpc-error'))
            })
            var callback = function(error, data) {
                should.not.exist(data)
                error.type.should.equal('auth')
                error.condition.should.equal('forbidden')
                xmpp.removeAllListeners('stanza')
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Can handle empty params', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction'
            }
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('rpc-result-no-params'))
            })
            var callback = function(error, data) {
                should.not.exist(error)
                data.should.eql([])
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Can handle simple params', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction'
            }
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('rpc-result-simple-params'))
            })
            var callback = function(error, data) {
                should.not.exist(error)
                data.length.should.equal(7)
                data[0].should.eql({ type: 'i4', value: 1 })
                data[1].should.eql({ type: 'int', value: 1 })
                data[2].should.eql({ type: 'string', value: 'stringValue' })
                data[3].should.eql({ type: 'double', value: 1234.2 })
                data[4].should.eql({ type: 'base64', value: 'base64' })
                data[5].should.eql({ type: 'boolean', value: true })
                data[6].should.eql({ type: 'dateTime.iso8601', value: 'datetimeValue' })
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Can handle arrays', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction'
            }
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('rpc-result-array'))
            })
            var callback = function(error, data) {
                should.not.exist(error)
                data.length.should.equal(1)
                data[0].type.should.equal('array')
                data[0].value.length.should.equal(2)
                data[0].value[0].should.eql({ type: 'string', value: 'one' })
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Can handle nested arrays', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction'
            }
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('rpc-result-array-nested'))
            })
            var callback = function(error, data) {
                should.not.exist(error)
                data.length.should.equal(1)
                data[0].type.should.equal('array')
                data[0].value.length.should.equal(1)
                data[0].value[0].value.should.eql([{ type: 'int', value: 2 }])
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Can handle structs', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction'
            }
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('rpc-result-struct'))
            })
            var callback = function(error, data) {
                should.not.exist(error)
                data.should.eql([
                    {
                        type: 'struct',
                        value: [
                            { type: 'string', value: 'one', name: 'PageNumber' },
                            { type: 'int', value: 2, name: 'RPP' }
                        ]
                    }
                ])
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

        it('Can handle nested structs', function(done) {
            var request = {
                to: 'rpc.server.com',
                method: 'example.performAction'
            }
            xmpp.once('stanza', function() {
                manager.makeCallback(helper.getStanza('rpc-result-struct-nested'))
            })
            var callback = function(error, data) {
                should.not.exist(error)
                data.should.eql([
                    {
                        type: 'struct',
                        value: [{
                            type: 'struct',
                            value: [
                                { type: 'int', value: 2, name: 'PageNumber' }
                            ],
                            name: 'Paging'
                        }]
                    }
                ])
                done()
            }
            socket.send(
                'xmpp.rpc.perform',
                request,
                callback
            )
        })

    })

    describe('Handle incoming RPC packets', function() {

        it('Can handle simple incoming RPC request', function(done) {

            socket.once('xmpp.rpc.request', function(data) {
                data.from.should.eql({
                    domain: 'company-a.com',
                    user: 'requester',
                    resource: 'jrpc-client'
                })
                data.command.should.equal('example.performAction')
                data.id.should.equal('1')
                should.not.exist(data.params)
                done()
            })
            rpc.handle(helper.getStanza('set-no-params'))
        })

        it('Can handle incoming request with simple params', function(done) {

            socket.once('xmpp.rpc.request', function(data) {
                data.from.should.eql({
                    domain: 'company-a.com',
                    user: 'requester',
                    resource: 'jrpc-client'
                })
                data.command.should.equal('example.performAction')
                data.id.should.equal('1')
                data.params.length.should.equal(7)

                data.params[0].should.eql({ type: 'i4', value: 1 })
                data.params[1].should.eql({ type: 'int', value: 1 })
                data.params[2].should.eql({ type: 'string', value: 'stringValue' })
                data.params[3].should.eql({ type: 'double', value: 1234.2 })
                data.params[4].should.eql({ type: 'base64', value: 'base64' })
                data.params[5].should.eql({ type: 'boolean', value: true })
                data.params[6].should.eql({
                    type: 'dateTime.iso8601',
                    value: 'datetimeValue'
                })
                done()
            })
            rpc.handle(helper.getStanza('set-simple-parameters'))
        })

        it('Can handle incoming request with arrays', function(done) {
            socket.once('xmpp.rpc.request', function(data) {
                data.from.should.eql({
                    domain: 'company-a.com',
                    user: 'requester',
                    resource: 'jrpc-client'
                })
                data.command.should.equal('example.performAction')
                data.id.should.equal('1')
                data.params.length.should.equal(1)
                data.params[0].type.should.equal('array')
                data.params[0].value.length.should.equal(2)
                data.params[0].value[0].should.eql({
                    type: 'string',
                    value: 'one'
                })
                data.params[0].value[1]
                    .should.eql({ type: 'int', value: 2 })
                done()
            })
            rpc.handle(helper.getStanza('set-array'))
        })

        it('Can handle incoming requests with nested arrays', function(done) {
            socket.once('xmpp.rpc.request', function(data) {
                data.from.should.eql({
                    domain: 'company-a.com',
                    user: 'requester',
                    resource: 'jrpc-client'
                })
                data.id.should.equal('1')
                data.command.should.equal('example.performAction')
                data.params.length.should.equal(1)
                data.params[0].type.should.equal('array')
                data.params[0].value.length.should.equal(1)
                data.params[0].value[0].value
                    .should.eql([{ type: 'int', value: 2 }])
                done()
            })
            rpc.handle(helper.getStanza('set-array-nested'))
        })

        it('Can handle incoming requests with structs', function(done) {
            socket.once('xmpp.rpc.request', function(data) {
                data.from.should.eql({
                    domain: 'company-a.com',
                    user: 'requester',
                    resource: 'jrpc-client'
                })
                data.command.should.equal('example.performAction')
                data.id.should.equal('1')
                data.params.length.should.equal(1)
                data.params.should.eql([
                    {
                        type: 'struct',
                        value: [
                            { type: 'string', value: 'one', name: 'PageNumber' },
                            { type: 'int', value: 2, name: 'RPP' }
                        ]
                    }
                ])
                done()
            })
            rpc.handle(helper.getStanza('set-struct'))
        })

        it('Can handle incoming requests with nested structs', function(done) {
            socket.once('xmpp.rpc.request', function(data) {
                data.from.should.eql({
                    domain: 'company-a.com',
                    user: 'requester',
                    resource: 'jrpc-client'
                })
                data.id.should.equal('1')
                data.command.should.equal('example.performAction')
                data.params.length.should.equal(1)
                data.params.should.eql([
                    {
                        type: 'struct',
                        value: [{
                            type: 'struct',
                            value: [
                                { type: 'int', value: 2, name: 'PageNumber' }
                            ],
                            name: 'Paging'
                        }]
                    }
                ])
                done()
            })
            rpc.handle(helper.getStanza('set-struct-nested'))
        })
    })

})
