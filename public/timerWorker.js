// timerWorker.js
const timers = {};

self.onmessage = function(e) {
  switch (e.data.type) {
    case 'START_TIMER':
      startTimer(e.data.id, e.data.endTime);
      break;
    case 'STOP_TIMER':
      stopTimer(e.data.id);
      break;
    case 'CHECK_TIMERS':
      checkTimers();
      break;
  }
};

function startTimer(id, endTime) {
  timers[id] = setInterval(() => {
    const now = Date.now();
    const timeLeft = endTime - now;

    if (timeLeft <= 0) {
      clearInterval(timers[id]);
      delete timers[id];
      self.postMessage({ type: 'TIMER_FINISHED', id });
    } else {
      self.postMessage({ type: 'TIMER_UPDATE', id, timeLeft });
    }
  }, 1000);
}

function stopTimer(id) {
  if (timers[id]) {
    clearInterval(timers[id]);
    delete timers[id];
  }
}

function checkTimers() {
  const now = Date.now();
  Object.keys(timers).forEach(id => {
    const timeLeft = endTime - now;
    if (timeLeft <= 0) {
      clearInterval(timers[id]);
      delete timers[id];
      self.postMessage({ type: 'TIMER_FINISHED', id });
    } else {
      self.postMessage({ type: 'TIMER_UPDATE', id, timeLeft });
    }
  });
}

// Iniciar un intervalo para verificar los temporizadores cada segundo
setInterval(checkTimers, 1000);