
// this file is only for reverse compatibility
// required for node v5.1.1 (older)

var nodeVer = (process.versions || {}).node || ''

module.exports = {
	bufferFrom: function(str) {
		return nodeVer == '5.1.1' ? new Buffer(str) : Buffer.from(str)
	},
	bufferLength: function(buff) {
		return nodeVer == '5.1.1' ? buff.length : Buffer.byteLength(buff)
	}
}