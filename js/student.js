let studentClass = "";
let studentRoll = "";
let studentCode = "";        // full 9-character code; identifies who owns a submission
let activeFilter = "all";
let mySubmissions = [];      // this student's own submissions (used by edit/delete)

// Toggles between the menu, feed, leave letter, DAK, and My Posts screens.
// Loads the feed / My Posts list fresh each time that screen is opened.
function showStudentScreen(id) {
  document.querySelectorAll(".screen").forEach(function(el) {
    el.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
  if (id === "studentFeedScreen") loadStudentFeed();
  if (id === "mySubmissionsScreen") loadMySubmissions();
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
    showToast("You have entered the wrong code. Redirecting you back...");
    setTimeout(function() { window.location.href = 'index.html'; }, 1800);
    return;
  }

  studentClass = classCode;
  studentRoll = roll;
  studentCode = code;
  // Title shows the student's roll number as "Student - 01" (roll "001" -> "01")
const rollNumber = parseInt(roll, 10);
const rollLabel = isNaN(rollNumber) ? roll : String(rollNumber).padStart(2, '0');
document.getElementById('studentTitle').textContent = "Student - " + rollLabel;
}

function setFilter(type) {
  activeFilter = type;
  document.querySelectorAll('#filters button').forEach(function(btn) {
    btn.classList.toggle('on', btn.dataset.type === type);
  });
  loadStudentFeed();
}

// Class feed: teachers' posts. Read-only for students (no edit/delete).
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
    return '<div class="post-item' + postColorClass(p) + '">' +
      '<div class="type">' + postTypeLabel(p) + '</div>' +
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
    student_code: studentCode,
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
      student_code: studentCode,
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

// ===== My Posts: the student's own leave letters and DAK activities =====
// Only submissions with this student's code are loaded, so edit/delete
// buttons never appear on anyone else's work.
async function loadMySubmissions() {
  const box = document.getElementById('mySubmissionsList');
  box.textContent = "Loading...";

  if (!studentCode) {
    box.textContent = "Sign in again to see your posts.";
    return;
  }

  const { data, error } = await sb.from('submissions').select('*')
    .eq('class_code', studentClass)
    .eq('student_code', studentCode)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    box.textContent = "Error loading your posts: " + error.message;
    return;
  }
  mySubmissions = data || [];
  renderMySubmissions();
}

// Draws the list from the submissions already loaded in mySubmissions.
function renderMySubmissions() {
  const box = document.getElementById('mySubmissionsList');
  if (mySubmissions.length === 0) {
    box.textContent = "You haven't posted anything yet.";
    return;
  }
  box.innerHTML = mySubmissions.map(renderMySubmission).join('');
}

// One of the student's submissions, with Edit and Delete buttons.
function renderMySubmission(s) {
  const label = s.type === 'leave_letter' ? 'Leave letter' : 'DAK activity';
  return '<div class="post-item" id="sub-' + s.id + '">' +
    '<div class="type">' + label + ' · ' + escapeHtml(s.student_name) + '</div>' +
    '<div>' + escapeHtml(s.content) + '</div>' +
    (s.file_url ? '<a href="' + s.file_url + '" target="_blank" style="font-size:12px;color:var(--coral);font-weight:700;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg> View photo</a>' : '') +
    '<div style="font-size:11px;color:var(--muted);margin-top:4px;">' + formatDate(s.created_at) + '</div>' +
    '<div class="post-actions">' +
      '<button class="mini-btn" onclick="startEditSubmission(\'' + s.id + '\')">Edit</button>' +
      '<button class="mini-btn delete" onclick="confirmDeleteSubmission(\'' + s.id + '\')">Delete</button>' +
    '</div>' +
    '</div>';
}

// Finds a submission in the loaded list by id.
function findSubmission(id) {
  return mySubmissions.find(function(s) { return String(s.id) === String(id); });
}

// Swaps one submission for an inline edit form (name + text).
// The attached photo, if any, is kept as it is.
function startEditSubmission(id) {
  const s = findSubmission(id);
  const el = document.getElementById('sub-' + id);
  if (!s || !el) return;

  el.classList.add('editing');
  el.innerHTML =
    '<label>Your name</label>' +
    '<input type="text" id="editName-' + id + '" value="' + escapeHtml(s.student_name) + '">' +
    '<label>' + (s.type === 'leave_letter' ? 'Letter' : 'Description') + '</label>' +
    '<textarea id="editContent-' + id + '">' + escapeHtml(s.content) + '</textarea>' +
    '<div id="editErr-' + id + '" style="font-size:12px;color:#C0392B;margin-top:6px;text-align:left;"></div>' +
    '<div class="post-actions">' +
      '<button class="mini-btn" onclick="renderMySubmissions()">Cancel</button>' +
      '<button class="mini-btn save" onclick="saveEditSubmission(\'' + id + '\')">Save</button>' +
    '</div>';
}

// Saves the edited name/text. The update only matches rows that carry
// this student's code, so it can't change anyone else's submission.
async function saveEditSubmission(id) {
  const name = document.getElementById('editName-' + id).value.trim();
  const content = document.getElementById('editContent-' + id).value.trim();
  const errBox = document.getElementById('editErr-' + id);
  errBox.textContent = "";

  if (!name || !content) {
    errBox.textContent = "Please fill in both fields.";
    return;
  }

  const { data, error } = await sb.from('submissions')
    .update({ student_name: name, content: content })
    .eq('id', id)
    .eq('student_code', studentCode)
    .select();

  if (error || !data || data.length === 0) {
    errBox.textContent = "Couldn't save changes. Please try again.";
    return;
  }
  loadMySubmissions();
}

// Asks "are you sure?" before deleting.
function confirmDeleteSubmission(id) {
  showConfirm("Delete this? This can't be undone.", function() {
    deleteSubmission(id);
  }, "Delete");
}

// Deletes the submission (and its photo, if any). Only matches rows that
// carry this student's code.
async function deleteSubmission(id) {
  const s = findSubmission(id);
  const { data, error } = await sb.from('submissions')
    .delete()
    .eq('id', id)
    .eq('student_code', studentCode)
    .select();

  if (error || !data || data.length === 0) {
    showToast("Couldn't delete it. Please try again.");
    return;
  }
  if (s) await deleteFromStorage(s.file_url);
  mySubmissions = mySubmissions.filter(function(x) { return String(x.id) !== String(id); });
  renderMySubmissions();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

initStudentPage();