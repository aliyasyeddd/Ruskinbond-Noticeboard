const SUPABASE_URL = "https://ugbbcndijxprlskizzme.supabase.co";
const SUPABASE_KEY = "sb_publishable_gnDhCCqjHd7BdfeWmdUAtQ_iAPuu9U4";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Reads ?code=XXXXXXXXX from the current page's URL.
// index.html appends this when it sends someone to teacher.html or
// student.html, so the dashboard knows who it's showing.
function getCodeFromURL() {
  return new URLSearchParams(window.location.search).get('code') || '';
}

// Friendly names for the 3-letter subject codes, used in the teacher badge.
const SUBJECT_NAMES = {
  MAT: "Maths", EVS: "EVS", ENG: "English",
  TEL: "Telugu", HIN: "Hindi", COM: "Computer"
};

// Shows a pop-up message centered on screen (with a dimmed backdrop)
// instead of the browser's plain alert() popup. It stays open until the
// user presses the Close button (or taps the dimmed area behind it).
// Lives here (not app.js) because teacher.html and student.html need it
// too, and both already load db.js.
function showToast(message) {
  var backdrop = document.getElementById('appToastBackdrop');
  var el = document.getElementById('appToast');

  // Create the backdrop and toast box the first time a message is shown.
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

  // Rebuild the contents each time: the message, then the Close button below it.
  el.innerHTML = '';

  var text = document.createElement('div');
  text.className = 'toast-text';
  text.textContent = message;

  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', hideToast);

  el.appendChild(text);
  el.appendChild(closeBtn);

  el.classList.add('show');
  backdrop.classList.add('show');
}

// Hides the pop-up message and its dimmed backdrop.
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