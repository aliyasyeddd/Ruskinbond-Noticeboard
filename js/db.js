const SUPABASE_URL = "https://ugbbcndijxprlskizzme.supabase.co";
const SUPABASE_KEY = "sb_publishable_gnDhCCqjHd7BdfeWmdUAtQ_iAPuu9U4";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Reads ?code=XXXXXXXXX from the current page's URL.
// index.html appends this when it sends someone to teacher-dashboard.html or
// student-dashboard.html, so the dashboard knows who it's showing.
function getCodeFromURL() {
  return new URLSearchParams(window.location.search).get('code') || '';
}

// Friendly names for the 3-letter subject codes, used in the teacher badge.
const SUBJECT_NAMES = {
  MAT: "Maths", EVS: "EVS", ENG: "English",
  TEL: "Telugu", HIN: "Hindi", COM: "Computer"
};

// Shared pop-up used by showToast() and showConfirm(). Shows the message
// centered on screen (with a dimmed backdrop) and one button per entry in
// `buttons` ({ label, secondary, onClick }). Pressing any button closes
// the pop-up first, then runs that button's onClick (if it has one).
// Lives here (not app.js) because teacher-dashboard.html and student-dashboard.html
// need it too, and both already load db.js.
function openToast(message, buttons) {
  var backdrop = document.getElementById('appToastBackdrop');
  var el = document.getElementById('appToast');

  // Create the backdrop and pop-up box the first time one is needed.
  if (!el) {
    backdrop = document.createElement('div');
    backdrop.id = 'appToastBackdrop';
    backdrop.className = 'toast-backdrop';
    backdrop.addEventListener('click', hideToast);   // tapping outside also closes it
    document.body.appendChild(backdrop);

    el = document.createElement('div');
    el.id = 'appToast';
    el.className = 'toast';
    document.body.appendChild(el);
  }

  // Rebuild the contents each time: the message, then the buttons below it.
  el.innerHTML = '';

  var text = document.createElement('div');
  text.className = 'toast-text';
  text.textContent = message;
  el.appendChild(text);

  var row = document.createElement('div');
  row.className = 'toast-actions';
  buttons.forEach(function(b) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-btn' + (b.secondary ? ' secondary' : '');
    btn.textContent = b.label;
    btn.addEventListener('click', function() {
      hideToast();
      if (b.onClick) b.onClick();
    });
    row.appendChild(btn);
  });
  el.appendChild(row);

  el.classList.add('show');
  backdrop.classList.add('show');
}

// Simple message with a single Close button. Stays open until closed.
function showToast(message) {
  openToast(message, [{ label: 'Close' }]);
}

// Yes/No style question. Runs onYes() only if the user presses the
// confirm button; Cancel (or tapping outside) just closes it.
function showConfirm(message, onYes, yesLabel) {
  openToast(message, [
    { label: 'Cancel', secondary: true },
    { label: yesLabel || 'Yes', onClick: onYes }
  ]);
}

// Hides the pop-up and its dimmed backdrop.
function hideToast() {
  var backdrop = document.getElementById('appToastBackdrop');
  var el = document.getElementById('appToast');
  if (el) el.classList.remove('show');
  if (backdrop) backdrop.classList.remove('show');
}

// Formats an ISO timestamp as "September 30 · 11:26 AM" instead of the
// raw, clunkier default from toLocaleString(). Used everywhere a post
// or submission's date/time is shown.
function formatDate(iso) {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return dateStr + " · " + timeStr;
}

// Uploads a File object to the "uploads" storage bucket and returns
// its public URL. Used by both the teacher's post form and the
// student's DAK activity photo upload.
async function uploadToStorage(file, folder) {
  const path = folder + "/" + Date.now() + "_" + file.name.replace(/\s+/g, "_");
  const { error } = await sb.storage.from('uploads').upload(path, file);
  if (error) throw error;
  const { data } = sb.storage.from('uploads').getPublicUrl(path);
  return data.publicUrl;
}

// Removes a previously uploaded file from the "uploads" bucket, given the
// public URL that uploadToStorage() returned. Called after a post or
// submission is deleted so its file doesn't stay behind. Best effort:
// if it fails, the post is still deleted.
async function deleteFromStorage(url) {
  if (!url) return;
  try {
    const marker = '/object/public/uploads/';
    const i = url.indexOf(marker);
    if (i === -1) return;
    const path = decodeURIComponent(url.slice(i + marker.length));
    await sb.storage.from('uploads').remove([path]);
  } catch (e) {
    // ignore: the file is just left in storage
  }
}

// ===== Subject color coding for homework =====

// Display order of the subjects in dropdowns and the color legend.
const SUBJECT_ORDER = ['TEL', 'HIN', 'ENG', 'MAT', 'EVS', 'COM'];

// For a homework post, returns the CSS class that colors it by subject
// (e.g. " subj-ENG"). Uses the subject picked when posting; older posts
// without one fall back to the subject of the teacher who posted them.
// Other post types (announcement, holiday, event) get no subject color.
function postColorClass(p) {
  if (p.type !== 'homework') return '';
  var code = p.homework_subject || p.subject;
  return SUBJECT_NAMES[code] ? ' subj-' + code : '';
}

// Label shown at the top of a post, e.g. "homework · English".
// For homework it names the homework's subject; for other types it names
// the subject of the teacher who posted.
function postTypeLabel(p) {
  var code = p.type === 'homework' ? (p.homework_subject || p.subject) : p.subject;
  return p.type + ' · ' + (SUBJECT_NAMES[code] || code);
}

// Fills the element with the given id with a small color key
// ("Homework colors: Telugu, Hindi, English, ...").
function renderSubjectLegend(elementId) {
  var box = document.getElementById(elementId);
  if (!box) return;
  box.innerHTML = '<span class="subj-legend-label">Homework colors:</span>' +
    SUBJECT_ORDER.map(function(code) {
      return '<span class="subj-chip subj-' + code + '">' + SUBJECT_NAMES[code] + '</span>';
    }).join('');
}