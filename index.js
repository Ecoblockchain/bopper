var Stream = require('stream')
var Event = require('geval')
var workerTimer = require('worker-timer')

var inherits = require('util').inherits

module.exports = Bopper

function Bopper(audioContext){
  if (!(this instanceof Bopper)){
    return new Bopper(audioContext)
  }

  var self = this

  Stream.call(this)
  this.readable = true
  this.writable = false

  this.context = audioContext

  var cycleLength = (1 / audioContext.sampleRate) * 1024
  workerTimer.setInterval(bopperTick.bind(this), cycleLength * 1000)

  var tempo = 120

  this._state = {
    lastTo: 0,
    lastEndTime: 0,
    playing: false,
    bpm: tempo,
    beatDuration: 60 / tempo,
    increment: (tempo / 60) * cycleLength,
    cycleLength: cycleLength,
    preCycle: 2
  }

  // frp version
  this.onSchedule = Event(function(broadcast){
    self.on('data', broadcast)
  })
}

inherits(Bopper, Stream)

var proto = Bopper.prototype


proto.start = function(){
  this._state.playing = true
  this.emit('start')
}

proto.stop = function(){
  this._state.playing = false
  this.emit('stop')
}

proto.schedule = function(duration) {
  var state = this._state
  var currentTime = this.context.currentTime

  var endTime = this.context.currentTime + duration
  var time = state.lastEndTime

  if (endTime >= time) {
    state.lastEndTime = endTime

    if (state.playing){
      var duration = endTime - time
      var length = duration / state.beatDuration

      var from = state.lastTo
      var to = from + length
      state.lastTo = to

      // skip if getting behind
      //if ((currentTime - (state.cycleLength*3)) < time){
        this._schedule(time, from, to)
      //}
    }
  }

}

proto.setTempo = function(tempo){
  var bps = tempo/60
  var state = this._state
  state.beatDuration = 60/tempo
  state.increment = bps * state.cycleLength
  state.bpm = tempo
  this.emit('tempo', state.bpm)
}

proto.getTempo = function(){
  return this._state.bpm
}

proto.isPlaying = function(){
  return this._state.playing
}

proto.setPosition = function(position){
  this._state.lastTo = parseFloat(position)
}

proto.setSpeed = function(multiplier){
  var state = this._state

  multiplier = parseFloat(multiplier) || 0

  var tempo = state.bpm * multiplier
  var bps = tempo/60

  state.beatDuration = 60/tempo
  state.increment = bps * state.cycleLength
}


proto.getPositionAt = function(time){
  var state = this._state
  var delta = state.lastEndTime - time
  return state.lastTo - (delta / state.beatDuration)
}

proto.getTimeAt = function(position){
  var state = this._state
  var positionOffset = this.getCurrentPosition() - position
  return this.context.currentTime - (positionOffset * state.beatDuration)
}

proto.getCurrentPosition = function(){
  return this.getPositionAt(this.context.currentTime)
}

proto.getNextScheduleTime = function(){
  var state = this._state
  return state.lastEndTime
}

proto.getBeatDuration = function(){
  var state = this._state
  return state.beatDuration
}


proto._schedule = function(time, from, to){
  var state = this._state
  var duration = (to - from) * state.beatDuration
  this.emit('data', {
    from: from,
    to: to,
    time: time,
    duration: duration,
    beatDuration: state.beatDuration
  })
}

function bopperTick () {
  var state = this._state
  this.schedule(state.cycleLength * state.preCycle)
}
