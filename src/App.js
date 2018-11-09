import React, { Component } from 'react';
import './App.css';

import Broadcast from './components/broadcast';
import Watch from './components/watch';

class App extends Component {

  render() {
    return (
      <div className="body">
      <Broadcast video={false} audio={true} />
      <Watch />
      </div>
    );
  }
}

export default App;
