// Script for French B2 Journey site

// global voice variable for French speech
let frenchVoice = null;
function initVoices() {
  // get available voices and choose a French one
  let voices = speechSynthesis.getVoices();
  for (let v of voices) {
    if (v.lang && v.lang.startsWith('fr')) {
      frenchVoice = v;
      break;
    }
  }
}
// initialize voice selection (in case voices are loaded after)
speechSynthesis.onvoiceschanged = initVoices;
initVoices();

// Function to speak given text in French
function speakText(text) {
  if (!text) return;
  let utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  if (frenchVoice) {
    utterance.voice = frenchVoice;
  }
  speechSynthesis.speak(utterance);
}

// Attach event listeners to any play buttons (for vocabulary pronunciation)
document.addEventListener('DOMContentLoaded', () => {
  const playButtons = document.querySelectorAll('.play-button');
  playButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-text');
      speakText(text);
    });
  });
});

// Calendar page functionality
function generateCalendar(startDate, endDate, doneDates) {
  const calendarContainer = document.getElementById('calendar-container');
  calendarContainer.innerHTML = '';
  // Day labels in French for Monday-first week
  const days = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
  // Month names in French
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  // Loop through each month from start to end inclusive
  while (current <= end) {
    const year = current.getFullYear();
    const monthIndex = current.getMonth();
    const monthName = months[monthIndex] + ' ' + year;
    // Create month label
    const monthLabel = document.createElement('div');
    monthLabel.className = 'calendar-month';
    monthLabel.textContent = monthName;
    calendarContainer.appendChild(monthLabel);
    // Create table for this month
    const table = document.createElement('table');
    table.className = 'calendar-table';
    // Create header row for days
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    days.forEach(day => {
      const th = document.createElement('th');
      th.textContent = day;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    // Create body
    const tbody = document.createElement('tbody');
    // Get day of week for 1st of the month (Monday=0, ... Sunday=6)
    let firstDay = new Date(year, monthIndex, 1);
    let startDayIndex = (firstDay.getDay() + 6) % 7; // convert JS Sunday-based to Monday-based index
    let daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    let dateNum = 1;
    let row = document.createElement('tr');
    // Fill initial empty cells if month doesn't start on Monday
    for (let i = 0; i < startDayIndex; i++) {
      const emptyCell = document.createElement('td');
      emptyCell.className = 'empty';
      emptyCell.innerHTML = '&nbsp;';
      row.appendChild(emptyCell);
    }
    // Fill in the days of the month
    const today = new Date();
    while (dateNum <= daysInMonth) {
      // If reached end of week, append row and create new
      if (row.children.length === 7) {
        tbody.appendChild(row);
        row = document.createElement('tr');
      }
      const cellDate = new Date(year, monthIndex, dateNum);
      const td = document.createElement('td');
      // Format date as YYYY-MM-DD for data attribute
      const isoDate = cellDate.toISOString().split('T')[0];
      td.setAttribute('data-date', isoDate);
      // Mark classes for today, done, future
      if (isoDate === today.toISOString().split('T')[0]) {
        td.classList.add('today');
      }
      if (doneDates.has(isoDate)) {
        td.classList.add('done');
      }
      if (cellDate > today) {
        td.classList.add('future');
      }
      td.textContent = dateNum;
      row.appendChild(td);
      dateNum++;
    }
    // Fill remaining cells of the last week with empties if needed
    while (row.children.length < 7) {
      const emptyCell = document.createElement('td');
      emptyCell.className = 'empty';
      emptyCell.innerHTML = '&nbsp;';
      row.appendChild(emptyCell);
    }
    tbody.appendChild(row);
    table.appendChild(tbody);
    calendarContainer.appendChild(table);
    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }
  // Attach click handler for marking days
  calendarContainer.querySelectorAll('td').forEach(td => {
    if (!td.classList.contains('empty') && !td.classList.contains('future')) {
      td.addEventListener('click', () => {
        const dateStr = td.getAttribute('data-date');
        if (!dateStr) return;
        if (td.classList.contains('done')) {
          // unmark
          td.classList.remove('done');
          doneDates.delete(dateStr);
        } else {
          // mark as done
          td.classList.add('done');
          doneDates.add(dateStr);
        }
        // save updated doneDates to localStorage
        localStorage.setItem('frenchB2JourneyDoneDates', JSON.stringify(Array.from(doneDates)));
        // update summary counts
        updateSummary(startDate, endDate, doneDates);
      });
    }
  });
}

// Update the summary text (days studied, days left)
function updateSummary(startDate, endDate, doneDates) {
  const summaryDiv = document.getElementById('summary');
  const today = new Date();
  // total days from start to target inclusive
  const totalDays = Math.floor((endDate - startDate) / (1000*60*60*24)) + 1;
  // days left from today to target (inclusive of target day if today <= target)
  let daysLeft = Math.floor((endDate - today) / (1000*60*60*24));
  if (daysLeft < 0) daysLeft = 0;
  // number of days studied (doneDates size)
  const studiedDays = doneDates.size;
  summaryDiv.textContent = `Days studied: ${studiedDays} / ${totalDays} | Days left: ${daysLeft}`;
}

// If on the calendar page, initialize functionality
document.addEventListener('DOMContentLoaded', () => {
  const calPage = document.getElementById('calendar-page');
  if (calPage) {
    const targetInput = document.getElementById('target-date');
    const setBtn = document.getElementById('set-date-button');
    // Load saved target date and done dates if available
    let targetDateStr = localStorage.getItem('frenchB2JourneyTarget');
    let startDateStr = localStorage.getItem('frenchB2JourneyStart');
    let doneDatesData = localStorage.getItem('frenchB2JourneyDoneDates');
    let doneDates = new Set();
    if (doneDatesData) {
      try {
        const arr = JSON.parse(doneDatesData);
        if (Array.isArray(arr)) {
          doneDates = new Set(arr);
        }
      } catch(e) { console.error('Error parsing done dates'); }
    }
    let targetDate = null;
    let startDate = null;
    if (targetDateStr) {
      targetDate = new Date(targetDateStr);
      if (isNaN(targetDate)) targetDate = null;
    }
    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (isNaN(startDate)) startDate = null;
    }
    if (targetDate) {
      // If start date not set, assume today as start
      if (!startDate) {
        startDate = new Date();
        localStorage.setItem('frenchB2JourneyStart', startDate.toISOString().split('T')[0]);
      }
      // Set input to target
      targetInput.value = targetDate.toISOString().split('T')[0];
      // Generate calendar
      generateCalendar(startDate, targetDate, doneDates);
      // Update summary
      updateSummary(startDate, targetDate, doneDates);
    } else {
      const summaryDiv = document.getElementById('summary');
      summaryDiv.textContent = 'No target date set. Please choose a date.';
    }
    // Set button handler
    setBtn.addEventListener('click', () => {
      const dateVal = targetInput.value;
      if (dateVal) {
        targetDate = new Date(dateVal);
        if (isNaN(targetDate)) {
          alert('Invalid date.');
          return;
        }
        // Save target date
        localStorage.setItem('frenchB2JourneyTarget', targetDate.toISOString().split('T')[0]);
        // If no start date saved, set start date as today
        if (!localStorage.getItem('frenchB2JourneyStart')) {
          startDate = new Date();
          localStorage.setItem('frenchB2JourneyStart', startDate.toISOString().split('T')[0]);
        } else {
          startDate = new Date(localStorage.getItem('frenchB2JourneyStart'));
          if (isNaN(startDate)) {
            startDate = new Date();
            localStorage.setItem('frenchB2JourneyStart', startDate.toISOString().split('T')[0]);
          }
        }
        // Reinitialize doneDates (if target changed, we keep doneDates but ensure none beyond new target)
        doneDates = new Set(JSON.parse(localStorage.getItem('frenchB2JourneyDoneDates') || '[]'));
        // Remove any done dates beyond new target date
        for (let d of doneDates) {
          if (new Date(d) > targetDate) {
            doneDates.delete(d);
          }
        }
        localStorage.setItem('frenchB2JourneyDoneDates', JSON.stringify(Array.from(doneDates)));
        // Generate calendar and update summary
        generateCalendar(startDate, targetDate, doneDates);
        updateSummary(startDate, targetDate, doneDates);
      }
    });
  }
});

// Highlight active nav link (if not already set in HTML)
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  const page = path.substring(path.lastIndexOf('/')+1) || 'index.html';
  document.querySelectorAll('nav a').forEach(link => {
    const hrefPage = link.getAttribute('href');
    if (hrefPage === page) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});
