// Grabs every element with class "screen", hides all of them,
// then shows only the one whose id was passed in.
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(el) {
    el.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
}

// Short, readable names for showScreen() calls, matching the
// onclick handlers used in index.html.
function showRoleSelect() { showScreen('roleSelectScreen'); }
function showTeacher()    { showScreen('teacherScreen'); }
function showStudent()    { showScreen('studentScreen'); }

// Called by the "Continue" buttons on the code-entry screens. Checks
// the code is the right length, then sends the code along in the URL
// so teacher-dashboard.html / student-dashboard.html know which class
// (and subject, or roll number) to show.
async function continueAsTeacher() {
  var code = document.getElementById('teacherCodeInput').value.trim().toUpperCase();
  if (code.length !== 9) {
    showToast("Please enter the full 9-character code (class + subject).");
    return;
  }
  const { data, error } = await sb.from('teachers').select('*').eq('code', code).maybeSingle();
  if (error) {
    showToast("Something went wrong checking that code. Try again.");
    return;
  }
  if (!data) {
    showToast("You have entered the wrong code. Please enter the code correctly.");
    return;
  }
  window.location.href = 'teacher-dashboard.html?code=' + code;
}
async function continueAsStudent() {
  var code = document.getElementById('studentCodeInput').value.trim().toUpperCase();
  if (code.length !== 9) {
    showToast("Please enter the full 9-character code (class + roll number).");
    return;
  }
  const { data, error } = await sb.from('students').select('*').eq('code', code).maybeSingle();
  if (error) {
    showToast("Something went wrong checking that code. Try again.");
    return;
  }
  if (!data) {
    showToast("You have entered the wrong code. Please enter the code correctly.");
    return;
  }
  window.location.href = 'student-dashboard.html?code=' + code;
}