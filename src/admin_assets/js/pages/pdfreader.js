(function(window){
var doc_query = querystring.parse(get_url_query(document.location+'')),
pdf_url = doc_query ? doc_query.waurl : null,
external_b = doc_query ? typeof doc_query.external != 'undefined' : null,
pdf_url_dir;
if(pdf_url)
{
  if(!external_b)
    pdf_url = s3bucket_file_url(pdf_url);
  pdf_url_dir = url_dir(pdf_url);
}

$(function(){
  var pdf_viewer = $('.pdfviewer');
  if(pdf_url)
  {
    PDFJS.disableRange = false;
    pdf_viewer.pdfviewer('loadDocument', pdf_url, function(err)
      {
        if(err)
          notifyUserError(err);
      });
  }
  pdf_viewer.bind('new-link', function(ev, data, page)
     {
       if(data.url)
       {
         data.protocol = url('protocol', data.url);
         data.real_url = data.url;
         data.url = librelio_pdf_resolve_url(data.url, pdf_url_dir);
       }
     });
});

})(window);
