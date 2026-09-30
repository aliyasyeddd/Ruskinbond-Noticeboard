let studentClass = "";
let studentRoll = "";
let activeFilter = "all";

// Toggles between the menu, feed, leave letter, and DAK screens.
// Loads the feed fresh each time that screen is opened.
function showStudentScreen(id) {
  document.querySelectorAll(".screen").forEach(function(el) {
    el.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
  if (id === "studentFeedScreen") loadStudentFeed();
}

async function initStudentPage() {
  const code = getCodeFromURL();
  if (code.length !== 9) {
    document.getElementById('studentTitle').textContent = "Invalid code";
    return;
  }
  const classCode = code.slice(0, 6);
  const roll = code.slice(6);

  const { data, error } = await sb.from('students').select('*').eq('code', code).maybeSingle();
  if (error || !data) {
    document.getElementById('studentTitle').textContent = "Code not recognized";
    showToast("That code wasn't found. Redirecting you back...");
    setTimeout(function() { window.location.href = 'index.html'; }, 1800);
    return;
  }

  studentClass = classCode;
  studentRoll = roll;
  document.getElementById('studentTitle').textContent = "Class 5 · Ruskin Bond (" + studentClass + ")";
}

function setFilter(type) {
  activeFilter = type;
  document.querySelectorAll('#filters button').forEach(function(btn) {
    btn.classList.toggle('on', btn.dataset.type === type);
  });
  loadStudentFeed();
}

async function loadStudentFeed() {
  const box = document.getElementById('studentFeed');
  box.textContent = "Loading...";

  let query = sb.from('posts').select('*')
    .eq('class_code', studentClass)
    .order('created_at', { ascending: false })
    .limit(30);

  if (activeFilter !== 'all') query = query.eq('type', activeFilter);

  const { data, error } = await query;

  if (error) {
    box.textContent = "Error loading feed: " + error.message;
    return;
  }
  if (!data || data.length === 0) {
    box.textContent = "Nothing posted yet.";
    return;
  }

  box.innerHTML = data.map(function(p) {
    return '<div class="post-item">' +
      '<div class="type">' + p.type + ' · ' + (SUBJECT_NAMES[p.subject] || p.subject) + '</div>' +
      '<div>' + escapeHtml(p.content) + '</div>' +
      (p.file_url ? '<a href="' + p.file_url + '" target="_blank" style="font-size:12px;color:var(--coral);font-weight:700;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg> View attachment</a>' : '') +
      '<div style="font-size:11px;color:var(--muted);margin-top:4px;">' + formatDate(p.created_at) + '</div>' +
      '</div>';
  }).join('');
}

async function submitLeave() {
  const name = document.getElementById('leaveName').value.trim();
  const content = document.getElementById('leaveContent').value.trim();
  const errBox = document.getElementById('leaveErr');
  errBox.textContent = "";

  if (!name || !content) {
    errBox.style.color = "#C0392B";
    errBox.textContent = "Please fill in your name and the letter.";
    return;
  }

  const { error } = await sb.from('submissions').insert({
    class_code: studentClass,
    type: 'leave_letter',
    student_name: name,
    content: content
  });

  if (error) {
    errBox.style.color = "#C0392B";
    errBox.textContent = "Error: " + error.message;
    return;
  }
  document.getElementById('leaveName').value = "";
  document.getElementById('leaveContent').value = "";
  errBox.style.color = "green";
  errBox.textContent = "Letter submitted!";
}

async function submitDak() {
  const name = document.getElementById('dakName').value.trim();
  const content = document.getElementById('dakContent').value.trim();
  const fileInput = document.getElementById('dakFile');
  const errBox = document.getElementById('dakErr');
  errBox.textContent = "";

  if (!name || !content) {
    errBox.style.color = "#C0392B";
    errBox.textContent = "Please fill in your name and description.";
    return;
  }

  try {
    let file_url = null;
    if (fileInput.files && fileInput.files[0]) {
      file_url = await uploadToStorage(fileInput.files[0], "dak");
    }
    const { error } = await sb.from('submissions').insert({
      class_code: studentClass,
      type: 'dak_activity',
      student_name: name,
      content: content,
      file_url: file_url
    });
    if (error) throw error;

    document.getElementById('dakName').value = "";
    document.getElementById('dakContent').value = "";
    fileInput.value = "";
    errBox.style.color = "green";
    errBox.textContent = "Activity posted!";
  } catch (e) {
    errBox.style.color = "#C0392B";
    errBox.textContent = "Error: " + e.message;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

initStudentPage();