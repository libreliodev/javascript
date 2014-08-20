function notifyError(err)
{
  alert(err);
}

function url4webview(url_str)
{
  return (url_str[0] == '/' ? 'cache:/' + url_str : 'app://' + url_str);
}
