let teacherClass = "";
let teacherSubject = "";
let teacherPosts = [];   // posts currently shown in the teacher's feed (used by edit/delete)
let teacherFilter = "all";   // active feed filter: all, homework, announcement, holiday, event, or mine

// Options for the post type dropdown, shared by the post form and the edit form.
const POST_TYPES = [
  ['homework', 'Homework'],
  ['announcement', 'Exam Announcement'],
  ['holiday', 'Holiday'],
  ['event', 'Event']
];

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
    showToast("You have entered the wrong code. Redirecting you back...");
    setTimeout(function() { window.location.href = 'index.html'; }, 1800);
    return;
  }

  teacherClass = classCode;
  teacherSubject = subject;
  // Default the homework subject dropdown to this teacher's own subject
  if (SUBJECT_NAMES[teacherSubject]) document.getElementById('postSubject').value = teacherSubject;
  const subjectName = SUBJECT_NAMES[teacherSubject] || teacherSubject;
  // Friendly greeting shown in the badge on the teacher menu, e.g. "Hi, EVS Teacher! Welcome back"
  document.getElementById('teacherBadge').textContent = "Hi, " + subjectName + " Teacher! Welcome back";
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

  if (!type) {
    errBox.textContent = "Please choose a type before posting.";
    return;
  }
  if (type === 'homework' && !document.getElementById('postSubject').value) {
    errBox.textContent = "Please choose a subject for the homework.";
    return;
  }
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
      homework_subject: type === 'homework' ? document.getElementById('postSubject').value : null,
      type: type,
      content: content,
      file_url: file_url
    });
    if (error) throw error;

    document.getElementById('postContent').value = "";
    document.getElementById('postType').value = "";   // back to "Select a type..."
    toggleHomeworkSubject();
    document.getElementById('postFileChoose').value = "";
    document.getElementById('postFileCamera').value = "";
    document.getElementById('teacherFileName').textContent = "";
    loadTeacherFeed();
  } catch (e) {
    errBox.textContent = "Error: " + e.message;
  }
}

// Switches the feed filter chip and reloads the feed.
function setTeacherFilter(type) {
  teacherFilter = type;
  document.querySelectorAll('#teacherFilters button').forEach(function(btn) {
    btn.classList.toggle('on', btn.dataset.type === type);
  });
  loadTeacherFeed();
}

// Fetches the posts for this teacher's class from ALL subjects, so every
// teacher can see what the others posted (e.g. other subjects' homework).
// Only posts from this teacher's own subject get Edit/Delete buttons.
async function loadTeacherFeed() {
  const box = document.getElementById('teacherFeed');
  box.textContent = "Loading...";

  let query = sb.from('posts').select('*')
    .eq('class_code', teacherClass)
    .order('created_at', { ascending: false })
    .limit(30);

  if (teacherFilter === 'mine') query = query.eq('subject', teacherSubject);
  else if (teacherFilter !== 'all') query = query.eq('type', teacherFilter);

  const { data, error } = await query;

  if (error) {
    box.textContent = "Error loading posts: " + error.message;
    return;
  }
  teacherPosts = data || [];
  renderTeacherFeed();
}

// Draws the feed from the posts already loaded in teacherPosts.
function renderTeacherFeed() {
  const box = document.getElementById('teacherFeed');
  if (teacherPosts.length === 0) {
    box.textContent = "Nothing posted yet.";
    return;
  }
  box.innerHTML = teacherPosts.map(renderTeacherPost).join('');
}

// One post in the feed. The label shows the post type and which subject
// posted it. Edit/Delete only appear on this teacher's own subject's posts;
// other teachers' posts are view-only.
function renderTeacherPost(p) {
  const isMine = p.subject === teacherSubject;
  const actions = isMine
    ? '<div class="post-actions">' +
        '<button class="mini-btn" onclick="startEditPost(\'' + p.id + '\')">Edit</button>' +
        '<button class="mini-btn delete" onclick="confirmDeletePost(\'' + p.id + '\')">Delete</button>' +
      '</div>'
    : '';
  return '<div class="post-item' + postColorClass(p) + '" id="post-' + p.id + '">' +
    '<div class="type">' + postTypeLabel(p) + (isMine ? ' · You' : '') + '</div>' +
    '<div>' + escapeHtml(p.content) + '</div>' +
    (p.file_url ? '<a href="' + p.file_url + '" target="_blank" style="font-size:12px;color:var(--coral);font-weight:700;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg> View attachment</a>' : '') +
    '<div style="font-size:11px;color:var(--muted);margin-top:4px;">' + formatDate(p.created_at) + '</div>' +
    actions +
    '</div>';
}

// Shows the subject dropdown in the post form only when the type is Homework.
function toggleHomeworkSubject() {
  document.getElementById('homeworkSubjectWrap').style.display =
    document.getElementById('postType').value === 'homework' ? 'block' : 'none';
}

// Same as above, for the inline edit form of a post.
function toggleEditSubject(id) {
  document.getElementById('editSubjectWrap-' + id).style.display =
    document.getElementById('editType-' + id).value === 'homework' ? 'block' : 'none';
}

// Finds a post in the loaded list by id.
function findPost(id) {
  return teacherPosts.find(function(p) { return String(p.id) === String(id); });
}

// Swaps one post for an inline edit form (type + message).
function startEditPost(id) {
  const p = findPost(id);
  const el = document.getElementById('post-' + id);
  if (!p || !el) return;

  const options = POST_TYPES.map(function(t) {
    return '<option value="' + t[0] + '"' + (t[0] === p.type ? ' selected' : '') + '>' + t[1] + '</option>';
  }).join('');

  const currentSubject = p.homework_subject || p.subject;
  const subjectOptions = SUBJECT_ORDER.map(function(code) {
    return '<option value="' + code + '"' + (code === currentSubject ? ' selected' : '') + '>' + SUBJECT_NAMES[code] + '</option>';
  }).join('');

  el.classList.add('editing');
  el.innerHTML =
    '<label>Type</label>' +
    '<select id="editType-' + id + '" onchange="toggleEditSubject(\'' + id + '\')">' + options + '</select>' +
    '<div id="editSubjectWrap-' + id + '" style="display:' + (p.type === 'homework' ? 'block' : 'none') + ';">' +
      '<label>Subject</label>' +
      '<select id="editSubject-' + id + '">' + subjectOptions + '</select>' +
    '</div>' +
    '<label>Message</label>' +
    '<textarea id="editContent-' + id + '">' + escapeHtml(p.content) + '</textarea>' +
    '<div id="editErr-' + id + '" style="font-size:12px;color:#C0392B;margin-top:6px;text-align:left;"></div>' +
    '<div class="post-actions">' +
      '<button class="mini-btn" onclick="renderTeacherFeed()">Cancel</button>' +
      '<button class="mini-btn save" onclick="saveEditPost(\'' + id + '\')">Save</button>' +
    '</div>';
}

// Saves the edited type/message. The update is limited to this teacher's
// class and subject, so it can never touch someone else's post.
async function saveEditPost(id) {
  const type = document.getElementById('editType-' + id).value;
  const content = document.getElementById('editContent-' + id).value.trim();
  const errBox = document.getElementById('editErr-' + id);
  errBox.textContent = "";

  if (!content) {
    errBox.textContent = "The message can't be empty.";
    return;
  }

  const { data, error } = await sb.from('posts')
    .update({
      type: type,
      content: content,
      homework_subject: type === 'homework' ? document.getElementById('editSubject-' + id).value : null
    })
    .eq('id', id)
    .eq('class_code', teacherClass)
    .eq('subject', teacherSubject)
    .select();

  if (error || !data || data.length === 0) {
    errBox.textContent = "Couldn't save changes. Please try again.";
    return;
  }
  loadTeacherFeed();
}

// Asks "are you sure?" before deleting.
function confirmDeletePost(id) {
  showConfirm("Delete this post? This can't be undone.", function() {
    deletePost(id);
  }, "Delete");
}

// Deletes the post (and its attached file, if any). Limited to this
// teacher's class and subject.
async function deletePost(id) {
  const p = findPost(id);
  const { data, error } = await sb.from('posts')
    .delete()
    .eq('id', id)
    .eq('class_code', teacherClass)
    .eq('subject', teacherSubject)
    .select();

  if (error || !data || data.length === 0) {
    showToast("Couldn't delete the post. Please try again.");
    return;
  }
  if (p) await deleteFromStorage(p.file_url);
  teacherPosts = teacherPosts.filter(function(x) { return String(x.id) !== String(id); });
  renderTeacherFeed();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Fetches leave letters + DAK activities for this class (all subjects
// share the same submissions, since students submit once per class,
// not once per subject) and splits them into the two lists on screen.
// These are read-only for teachers: only the student who wrote one can
// edit or delete it.
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

renderSubjectLegend('teacherLegend');
initTeacherPage();