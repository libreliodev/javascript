function notifyError(err)
{
  alert(err);
}


function get_url_query(url)
{
  var idx = url.indexOf('?'),
  idx2 = url.indexOf('#');
  return idx == -1 ? '' : 
    (idx2 == -1 ? url.substr(idx + 1) : url.substring(idx + 1, idx2));
}
