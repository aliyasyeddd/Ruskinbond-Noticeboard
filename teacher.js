let teacherClass = "";
let teacherSubject = "";

// Toggles between the menu, post form, and feed screens on this page.
// Loads the feed fresh each time that screen is opened, so it is
// never stale after posting something new.
function showTeacherScreen(id) {
  document.querySelectorAll(".screen").forEach(function(el) {
    el.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
  if (id === "teacherFeedScreen") loadTeacherFeed();
  if (id === "submissionsScreen") loadSubmissions();
}

async function initTeacherPage() {
  const code = getCodeFromURL();
  if (code.length !== 9) {
    document.getElementById('teacherBadge').textContent = "Invalid code";
    return;
  }
  const classCode = code.slice(0, 6);
  const subject = code.slice(6);

  const { data, error } = await sb.from('teachers').select('*').eq('code', code).maybeSingle();
  if (error || !data) {
    document.getElementById('teacherBadge').textContent = "Code not recognized";
    showToast("That code wasn't found. Redirecting you back...");
    setTimeout(function() { window.location.href = 'index.html'; }, 1800);
    return;
  }

  teacherClass = classCode;
  teacherSubject = subject;
  const subjectName = SUBJECT_NAMES[teacherSubject] || teacherSubject;
  document.getElementById('teacherBadge').textContent = subjectName.toUpperCase() + " · " + teacherClass;
  loadTeacherFeed();
}

// Both the "Choose File" and "Take Photo" inputs call this on change,
// so whichever one the teacher used, we show the picked file's name.
function handleTeacherFile(input) {
  document.getElementById('teacherFileName').textContent =
    (input.files && input.files[0]) ? "Selected: " + input.files[0].name : "";
}

// Whichever of the two file inputs actually has a file picked.
function getSelectedFile() {
  const a = document.getElementById('postFileChoose');
  const b = document.getElementById('postFileCamera');
  if (a.files && a.files[0]) return a.files[0];
  if (b.files && b.files[0]) return b.files[0];
  return null;
}

async function createPost() {
  const type = document.getElementById('postType').value;
  const content = document.getElementById('postContent').value.trim();
  const errBox = document.getElementById('postErr');
  errBox.textContent = "";

  if (!content) {
    errBox.textContent = "Please write a message before posting.";
    return;
  }

  try {
    let file_url = null;
    const file = getSelectedFile();
    if (file) file_url = await uploadToStorage(file, "posts");

    const { error } = await sb.from('posts').insert({
      class_code: teacherClass,
      subject: teacherSubject,
      type: type,
      content: content,
      file_url: file_url
    });
    if (error) throw error;

    document.getElementById('postContent').value = "";
    document.getElementById('postFileChoose').value = "";
    document.getElementById('postFileCamera').value = "";
    document.getElementById('teacherFileName').textContent = "";
    loadTeacherFeed();
  } catch (e) {
    errBox.textContent = "Error: " + e.message;
  }
}

async function loadTeacherFeed() {
  const box = document.getElementById('teacherFeed');
  box.textContent = "Loading...";

  const { data, error } = await sb.from('posts').select('*')
    .eq('class_code', teacherClass)
    .eq('subject', teacherSubject)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    box.textContent = "Error loading posts: " + error.message;
    return;
  }
  if (!data || data.length === 0) {
    box.textContent = "Nothing posted yet.";
    return;
  }

  box.innerHTML = data.map(function(p) {
    return '<div class="post-item">' +
      '<div class="type">' + p.type + '</div>' +
      '<div>' + escapeHtml(p.content) + '</div>' +
      (p.file_url ? '<a href="' + p.file_url + '" target="_blank" style="font-size:12px;color:var(--coral);font-weight:700;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg> View attachment</a>' : '') +
      '<div style="font-size:11px;color:var(--muted);margin-top:4px;">' + formatDate(p.created_at) + '</div>' +
      '</div>';
  }).join('');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Fetches leave letters + DAK activities for this class (all subjects
// share the same submissions, since students submit once per class,
// not once per subject) and splits them into the two lists on screen.
async function loadSubmissions() {
  const leaveBox = document.getElementById('leaveLettersList');
  const dakBox = document.getElementById('dakActivitiesList');
  leaveBox.textContent = "Loading...";
  dakBox.textContent = "Loading...";

  const { data, error } = await sb.from('submissions').select('*')
    .eq('class_code', teacherClass)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    leaveBox.textContent = "Error: " + error.message;
    dakBox.textContent = "Error: " + error.message;
    return;
  }

  const leaves = data.filter(function(s) { return s.type === 'leave_letter'; });
  const daks = data.filter(function(s) { return s.type === 'dak_activity'; });

  leaveBox.innerHTML = leaves.length ? leaves.map(renderSubmission).join('') : "No leave letters yet.";
  dakBox.innerHTML = daks.length ? daks.map(renderSubmission).join('') : "No activities posted yet.";
}

function renderSubmission(s) {
  return '<div class="post-item">' +
    '<div class="type">' + escapeHtml(s.student_name) + '</div>' +
    '<div>' + escapeHtml(s.content) + '</div>' +
    (s.file_url ? '<a href="' + s.file_url + '" target="_blank" style="font-size:12px;color:var(--coral);font-weight:700;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg> View photo</a>' : '') +
    '<div style="font-size:11px;color:var(--muted);margin-top:4px;">' + formatDate(s.created_at) + '</div>' +
    '</div>';
}

initTeacherPage();