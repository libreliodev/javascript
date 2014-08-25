// Debug
console = new Object();
console.log = function(log) {
  var iframe = document.createElement("IFRAME");
  iframe.setAttribute("src", "ios-log:#iOS#" + log);
  document.documentElement.appendChild(iframe);
  iframe.parentNode.removeChild(iframe);
  iframe = null;    
};
console.debug = console.log;
console.info = console.log;
console.warn = console.log;
console.error = console.log;

function notifyError(err)
{
  alert(err);
}

function url4webview(url_str)
{
  return 'http://apphost' + url_str;
}
