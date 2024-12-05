function validateTimeFormat(time) {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

function validateDateFormat(date) {
  return /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(\d{4})$/.test(date);
}

module.exports = { validateTimeFormat, validateDateFormat };
