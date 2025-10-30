function generateTable() {
    const num = parseInt(document.getElementById("numProcesses").value);
    const table = document.getElementById("processTable").getElementsByTagName("tbody")[0];
    table.innerHTML = "";
    for (let i = 0; i < num; i++) {
      const row = table.insertRow();
      row.insertCell().innerText = `P${i + 1}`;
      row.insertCell().innerHTML = "<input type='number' min='0' value='0'>";
      row.insertCell().innerHTML = "<input type='number' min='1' value='1'>";
      row.insertCell().innerHTML = "<input type='number' min='1' value='1'>";
    }
  }

  function runAlgorithm() {
    const algorithm = document.getElementById("algorithm").value;
    const quantum = parseInt(document.getElementById("quantum").value);
    const throughputWindow = parseInt(document.getElementById("throughputWindow").value);
    const table = document.getElementById("processTable").getElementsByTagName("tbody")[0];
    const processes = [];

    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      processes.push({
        pid: i + 1,
        arrivalTime: parseInt(row.cells[1].children[0].value),
        burstTime: parseInt(row.cells[2].children[0].value),
        priority: parseInt(row.cells[3].children[0].value),
      });
    }

    let result;
    switch (algorithm) {
      case "fcfs":
        result = simulateFCFS(processes);
        break;
      case "sjf":
        result = simulateSJF(processes);
        break;
      case "srjf":
        result = simulateSRJF(processes);
        break;
      case "rr":
        result = simulateRR(processes, quantum);
        break;
      case "np_priority":
        result = simulateNonPreemptivePriority(processes);
        break;
      case "p_priority":
        result = simulatePreemptivePriority(processes);
        break;
      case "rr_np_priority":
        result = simulateRRWithPriority(processes, quantum);
        break;
    }

    displayResult(result, throughputWindow);
  }

 function displayResult({ gantt, metrics }, throughputWindow) { 
  const ganttChart = document.getElementById("ganttChart");
  ganttChart.innerHTML = ""; // Clear existing gantt chart

  // Assign random colors to processes
  const colorMap = {};
  metrics.forEach(m => {
    const hex = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    colorMap[`P${m.pid}`] = hex;
  });

  // Render Gantt Chart
  animateGantt(gantt, colorMap);

  if (gantt.length > 0) {
    const finalSpan = document.createElement("span");
    finalSpan.innerText = gantt[gantt.length - 1].end;
    finalSpan.style.position = "absolute";
    finalSpan.style.bottom = "-20px";
    finalSpan.style.left = `${gantt.length * 50}px`;
    finalSpan.style.fontSize = "12px"; // Optional styling
    ganttChart.appendChild(finalSpan);
  }

  // Metrics Table
  const metricsTable = document.getElementById("metricsTable");
  metricsTable.innerHTML = "<tr><th>Process</th><th>Waiting Time</th><th>Turnaround Time</th><th>Response Time</th><th>Completion Time</th></tr>";
  let totalWaiting = 0, totalTurnaround = 0, totalResponse = 0, completedInWindow = 0;

  metrics.forEach(m => {
    totalWaiting += m.waitingTime;
    totalTurnaround += m.turnaroundTime;
    totalResponse += m.responseTime;
    if (m.completionTime <= throughputWindow) completedInWindow++;

    const row = metricsTable.insertRow();
    row.style.backgroundColor = colorMap[`P${m.pid}`];
    row.insertCell().innerText = `P${m.pid}`;
    row.insertCell().innerText = m.waitingTime;
    row.insertCell().innerText = m.turnaroundTime;
    row.insertCell().innerText = m.responseTime;
    row.insertCell().innerText = m.completionTime;
  });

  document.getElementById("avgWaitingTime").innerText = `Average Waiting Time: ${(totalWaiting / metrics.length).toFixed(2)}`;
  document.getElementById("avgTurnaroundTime").innerText = `Average Turnaround Time: ${(totalTurnaround / metrics.length).toFixed(2)}`;
  document.getElementById("avgResponseTime").innerText = `Average Response Time: ${(totalResponse / metrics.length).toFixed(2)}`;
  document.getElementById("throughput").innerText = `Throughput in ${throughputWindow} ns: ${completedInWindow} processes`;
}


    function simulateFCFS(processes) {
      const gantt = [];
      const metrics = [];
      processes.sort((a, b) => a.arrivalTime - b.arrivalTime);
      let time = 0;

      for (let p of processes) {
        if (time < p.arrivalTime) time = p.arrivalTime;
        const start = time;
        const end = time + p.burstTime;
        gantt.push({ pid: p.pid, start, end });
        const turnaround = end - p.arrivalTime;
        const waiting = start - p.arrivalTime;
        const response = start - p.arrivalTime;
        metrics.push({ pid: p.pid, waitingTime: waiting, turnaroundTime: turnaround, responseTime: response, completionTime: end });
        time = end;
      }

      return { gantt, metrics };
    }

    function simulateSJF(processes) {
      const gantt = [];
      const n = processes.length;
      const metrics = processes.map(p => ({
        ...p,
        isCompleted: false,
        startTime: -1,
        completionTime: 0
      }));

      let time = 0, completed = 0;

      while (completed < n) {
        const available = metrics.filter(p => !p.isCompleted && p.arrivalTime <= time);
        if (available.length > 0) {
          available.sort((a, b) => a.burstTime - b.burstTime || a.arrivalTime - b.arrivalTime);
          const current = available[0];
          current.startTime = time;
          current.completionTime = time + current.burstTime;
          gantt.push({ pid: current.pid, start: time, end: current.completionTime });
          time = current.completionTime;
          current.isCompleted = true;
          completed++;
        } else {
          time++;
        }
      }

      const result = metrics.map(p => {
        const turnaround = p.completionTime - p.arrivalTime;
        const waiting = turnaround - p.burstTime;
        const response = p.startTime - p.arrivalTime;
        return {
          pid: p.pid,
          waitingTime: waiting,
          turnaroundTime: turnaround,
          responseTime: response,
          completionTime: p.completionTime
        };
      });

      return { gantt, metrics: result };
    }

    function simulateRR(processes, quantum) {
      const gantt = [];
      const metrics = processes.map(p => ({
        ...p,
        remaining: p.burstTime,
        startTime: -1,
        completionTime: 0
      }));

      let time = 0;
      const queue = [];
      const arrived = new Set();

      while (metrics.some(p => p.remaining > 0)) {
        metrics.forEach(p => {
          if (p.arrivalTime <= time && !arrived.has(p.pid)) {
            queue.push(p);
            arrived.add(p.pid);
          }
        });

        if (queue.length === 0) {
          time++;
          continue;
        }

        const p = queue.shift();
        if (p.startTime === -1) p.startTime = time;
        const execTime = Math.min(p.remaining, quantum);
        gantt.push({ pid: p.pid, start: time, end: time + execTime });
        time += execTime;
        p.remaining -= execTime;

        metrics.forEach(proc => {
          if (proc.arrivalTime <= time && !arrived.has(proc.pid)) {
            queue.push(proc);
            arrived.add(proc.pid);
          }
        });

        if (p.remaining > 0) {
          queue.push(p);
        } else {
          p.completionTime = time;
        }
      }

      const result = metrics.map(p => {
        const turnaround = p.completionTime - p.arrivalTime;
        const waiting = turnaround - p.burstTime;
        const response = p.startTime - p.arrivalTime;
        return {
          pid: p.pid,
          waitingTime: waiting,
          turnaroundTime: turnaround,
          responseTime: response,
          completionTime: p.completionTime
        };
      });

      return { gantt, metrics: result };
    }
    function simulateSRJF(processes) {
      let time = 0;
      const gantt = [];
      const n = processes.length;
      const metrics = processes.map(p => ({
        ...p,
        remaining: p.burstTime,
        startTime: -1,
        completionTime: 0
      }));
      let completed = 0;
      let prevPid = null;

      while (completed < n) {
        const available = metrics.filter(p => p.arrivalTime <= time && p.remaining > 0);
        if (available.length > 0) {
          available.sort((a, b) => a.remaining - b.remaining || a.arrivalTime - b.arrivalTime);
          const current = available[0];
          if (current.startTime === -1) current.startTime = time;
          if (prevPid !== current.pid) {
            gantt.push({ pid: current.pid, start: time, end: time + 1 });
          } else {
            gantt[gantt.length - 1].end = time + 1;
          }
          current.remaining--;
          time++;
          prevPid = current.pid;
          if (current.remaining === 0) {
            current.completionTime = time;
            completed++;
          }
        } else {
          time++;
          prevPid = null;
        }
      }

      const result = metrics.map(p => {
        const turnaround = p.completionTime - p.arrivalTime;
        const waiting = turnaround - p.burstTime;
        const response = p.startTime - p.arrivalTime;
        return {
          pid: p.pid,
          waitingTime: waiting,
          turnaroundTime: turnaround,
          responseTime: response,
          completionTime: p.completionTime
        };
      });

      return { gantt, metrics: result };
    }

    function simulatePreemptivePriority(processes) {
      let time = 0;
      const gantt = [];
      const metrics = processes.map(p => ({ ...p, remaining: p.burstTime, startTime: -1, completionTime: 0 }));
      let completed = 0;
      let prevPid = null;

      while (completed < metrics.length) {
        const available = metrics.filter(p => p.arrivalTime <= time && p.remaining > 0);
        if (available.length > 0) {
          available.sort((a, b) => a.priority - b.priority || a.arrivalTime - b.arrivalTime);
          const current = available[0];
          if (current.startTime === -1) current.startTime = time;
          if (prevPid !== current.pid) {
            gantt.push({ pid: current.pid, start: time, end: time + 1 });
          } else {
            gantt[gantt.length - 1].end = time + 1;
          }
          current.remaining--;
          time++;
          prevPid = current.pid;
          if (current.remaining === 0) {
            current.completionTime = time;
            completed++;
          }
        } else {
          time++;
          prevPid = null;
        }
      }

      const result = metrics.map(p => {
        const turnaround = p.completionTime - p.arrivalTime;
        const waiting = turnaround - p.burstTime;
        const response = p.startTime - p.arrivalTime;
        return {
          pid: p.pid,
          waitingTime: waiting,
          turnaroundTime: turnaround,
          responseTime: response,
          completionTime: p.completionTime
        };
      });

      return { gantt, metrics: result };
    }

    function simulateNonPreemptivePriority(processes) {
      const gantt = [];
      const n = processes.length;
      const metrics = processes.map(p => ({
        ...p,
        startTime: -1,
        completionTime: 0,
        isCompleted: false
      }));
      let time = 0, completed = 0;

      while (completed < n) {
        const available = metrics.filter(p => p.arrivalTime <= time && !p.isCompleted);

        if (available.length > 0) {
          available.sort((a, b) => a.priority - b.priority || a.burstTime - b.burstTime || a.arrivalTime - b.arrivalTime);
          const current = available[0];
          current.startTime = time;
          current.completionTime = time + current.burstTime;
          gantt.push({ pid: current.pid, start: time, end: current.completionTime });
          time = current.completionTime;
          current.isCompleted = true;
          completed++;
        } else {
          time++;
        }
      }

      const result = metrics.map(p => {
        const turnaround = p.completionTime - p.arrivalTime;
        const waiting = turnaround - p.burstTime;
        const response = p.startTime - p.arrivalTime;
        return {
          pid: p.pid,
          waitingTime: waiting,
          turnaroundTime: turnaround,
          responseTime: response,
          completionTime: p.completionTime
        };
      });

      return { gantt, metrics: result };
    }

    function simulateRRWithPriority(processes, quantum) {
      const gantt = [];
      const metrics = processes.map(p => ({
        ...p,
        remaining: p.burstTime,
        startTime: -1,
        completionTime: 0,
        finished: false
      }));
      let time = 0, completed = 0;

      // Group by priority
      const priorityGroups = [...new Set(metrics.map(p => p.priority))].sort((a, b) => a - b);

      while (completed < metrics.length) {
        let executed = false;
        for (let priority of priorityGroups) {
          const queue = metrics.filter(p => p.priority === priority && p.arrivalTime <= time && p.remaining > 0);

          if (queue.length === 0) continue;

          queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
          for (let i = 0; i < queue.length; i++) {
            const p = queue[i];
            const actualTime = Math.min(p.remaining, quantum);
            if (p.startTime === -1) p.startTime = time;
            gantt.push({ pid: p.pid, start: time, end: time + actualTime });
            time += actualTime;
            p.remaining -= actualTime;
            if (p.remaining === 0) {
              p.completionTime = time;
              p.finished = true;
              completed++;
            }
            executed = true;
          }
          if (executed) break;
        }
        if (!executed) time++;
      }

      const result = metrics.map(p => {
        const turnaround = p.completionTime - p.arrivalTime;
        const waiting = turnaround - p.burstTime;
        const response = p.startTime - p.arrivalTime;
        return {
          pid: p.pid,
          waitingTime: waiting,
          turnaroundTime: turnaround,
          responseTime: response,
          completionTime: p.completionTime
        };
      });

      return { gantt, metrics: result };
    }

function displayResult({ gantt, metrics }, throughputWindow) {
  const ganttChart = document.getElementById("ganttChart");
  ganttChart.innerHTML = "";

  // Assign random colors to processes
  const colorMap = {};
  metrics.forEach(m => {
    const hex = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    colorMap[`P${m.pid}`] = hex;
  });

  // Render Gantt Chart
animateGantt(gantt, colorMap);


  // Metrics Table
  const metricsTable = document.getElementById("metricsTable");
  metricsTable.innerHTML = "<tr><th>Process</th><th>Waiting Time</th><th>Turnaround Time</th><th>Response Time</th><th>Completion Time</th></tr>";
  let totalWaiting = 0, totalTurnaround = 0, totalResponse = 0, completedInWindow = 0;

  metrics.forEach(m => {
    totalWaiting += m.waitingTime;
    totalTurnaround += m.turnaroundTime;
    totalResponse += m.responseTime;
    if (m.completionTime <= throughputWindow) completedInWindow++;

    const row = metricsTable.insertRow();
    row.style.backgroundColor = colorMap[`P${m.pid}`];
    row.insertCell().innerText = `P${m.pid}`;
    row.insertCell().innerText = m.waitingTime;
    row.insertCell().innerText = m.turnaroundTime;
    row.insertCell().innerText = m.responseTime;
    row.insertCell().innerText = m.completionTime;
  });

  document.getElementById("avgWaitingTime").innerText = `Average Waiting Time: ${(totalWaiting / metrics.length).toFixed(2)}`;
  document.getElementById("avgTurnaroundTime").innerText = `Average Turnaround Time: ${(totalTurnaround / metrics.length).toFixed(2)}`;
  document.getElementById("avgResponseTime").innerText = `Average Response Time: ${(totalResponse / metrics.length).toFixed(2)}`;
  document.getElementById("throughput").innerText = `Throughput in ${throughputWindow} ns: ${completedInWindow} processes`;
}
function animateGantt(gantt, colorMap) {
  const ganttChart = document.getElementById("ganttChart");
  ganttChart.innerHTML = "";
  ganttChart.style.position = "relative";

  let i = 0;
  let offset = 0;
  let prevEnd = 0;

  function drawNext() {
    if (i >= gantt.length) return;

    const { pid, start, end } = gantt[i];
    const width = (end - start) * 40;
    const pidLabel = `P${pid}`;

    // Handle IDLE time if there's a gap before current process starts
    if (start > prevEnd) {
      const idleWidth = (start - prevEnd) * 40;

      const idleBlock = document.createElement("div");
      idleBlock.innerText = "IDLE";
      idleBlock.style.backgroundColor = "#b2bec3";
      idleBlock.style.width = `${idleWidth}px`;
      idleBlock.style.height = "40px";
      idleBlock.style.display = "inline-block";
      idleBlock.style.textAlign = "center";
      idleBlock.style.position = "absolute";
      idleBlock.style.left = `${offset}px`;
      idleBlock.style.top = "0";
      ganttChart.appendChild(idleBlock);

      // Start time label for IDLE
      const idleStart = document.createElement("span");
      idleStart.innerText = prevEnd;
      idleStart.style.position = "absolute";
      idleStart.style.left = `${offset}px`;
      idleStart.style.bottom = "-20px";
      idleStart.style.fontSize = "12px";
      ganttChart.appendChild(idleStart);

      // End time label for IDLE
      const idleEnd = document.createElement("span");
      idleEnd.innerText = start;
      idleEnd.style.position = "absolute";
      idleEnd.style.left = `${offset + idleWidth}px`;
      idleEnd.style.bottom = "-20px";
      idleEnd.style.fontSize = "12px";
      ganttChart.appendChild(idleEnd);

      offset += idleWidth;
    }

    // Process block
    const block = document.createElement("div");
    block.innerText = pidLabel;
    block.style.backgroundColor = colorMap[pidLabel];
    block.style.width = `${width}px`;
    block.style.height = "40px";
    block.style.display = "inline-block";
    block.style.textAlign = "center";
    block.style.position = "absolute";
    block.style.left = `${offset}px`;
    block.style.top = "0";
    ganttChart.appendChild(block);

    // Start time label
    const startLabel = document.createElement("span");
    startLabel.innerText = start;
    startLabel.style.position = "absolute";
    startLabel.style.left = `${offset}px`;
    startLabel.style.bottom = "-20px";
    startLabel.style.fontSize = "12px";
    ganttChart.appendChild(startLabel);

    // End time label
    const endLabel = document.createElement("span");
    endLabel.innerText = end;
    endLabel.style.position = "absolute";
    endLabel.style.left = `${offset + width}px`;
    endLabel.style.bottom = "-20px";
    endLabel.style.fontSize = "12px";
    ganttChart.appendChild(endLabel);

    prevEnd = end;
    offset += width;
    i++;

    setTimeout(drawNext, 1000); // Animation delay
  }

  drawNext();
}
