import React, { Component } from 'react';

var signalhub = require('signalhubws')
var swarm = require('webrtc-swarm')
var getUserMedia = require('getusermedia')
var recorder = require('media-recorder-stream')
var hypercore = require('hypercore')
var ram = require('random-access-memory')
var pump = require('pump')
var cluster = require('webm-cluster-stream')
var MicrophoneStream = require('microphone-stream');
var config = require('../config')
var mimeType = require('../lib/getMimeType')(window.MediaRecorder.isTypeSupported)

export default class Watch extends Component {
  constructor(props){
    super(props);
    this.input = React.createRef();
    this.startWatching = this.startWatching.bind(this);
  }

  startWatching () {
    var mediaSource = new window.MediaSource();
    const context = this;

    function open () {
      var sourceBuffer = mediaSource.addSourceBuffer(mimeType)

      var hash = context.input.value;
      var feed = hypercore(ram, hash, {sparse: true})
      feed.on('ready', function () {
        feed.download({ linear: true })

        var key = feed.discoveryKey.toString('hex')
        var hub = signalhub(key, config.signalhub)
        var sw = swarm(hub)
        console.log('🌐 connecting to swarm')

        sw.on('peer', function (peer, id) {
          console.log('🙋 new peer found:', id)
          pump(peer, feed.replicate({ live: true, download: true, encrypt: false }), peer)
        })

        var block = 0
        getBlock(function () {
          sourceBuffer.addEventListener('updateend', function () {
            getBlock()
          })
        })

        function getBlock (cb) {
          feed.get(block, function (err, data) {
            console.log('⚡️ appending block ' + block)
            sourceBuffer.appendBuffer(data.buffer)
            block++

            if (cb) return cb()
          })
        }
      })
    }

    mediaSource.addEventListener('sourceopen', open)
    var elPlayer = document.getElementById('player')
    elPlayer.src = window.URL.createObjectURL(mediaSource)
    elPlayer.play()
  }


  render(){
    let input;
    return (
      <div>
      this is the watching window
      <audio id="player" controls/>
      <input
        id="stationId"
        ref={node => this.input = node}
         />
      <button onClick={this.startWatching}>listen</button>
      </div>
    )
  }
}
