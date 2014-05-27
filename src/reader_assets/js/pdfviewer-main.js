$(function(){
  var doc_query = querystring.parse(get_url_query(document.location+'')),
  pdf_url = doc_query ? doc_query.waurl : null;
  if(pdf_url)
  {
    PDFJS.getDocument(pdf_url).then(function(pdf)
      {
        try {
          $('.pdfviewer').pdfviewer('set', 'pdfDoc', pdf);
        }catch(e) {
          console.error(e);
        }
      })
      .catch(function(err)
        {
          notifyError(err);
        });
  }
  $('.portrait-mode-btn').click(function(){ 
    change_display_mode('portrait');
    return false;
  });
  $('.book-mode-btn').click(function(){ 
    change_display_mode('book');
    return false;
  });
  function change_display_mode(disp_mode)
  {
    var display_mode = $('.pdfviewer').pdfviewer('get', 'display_mode');
    if(display_mode != disp_mode)
      $('.pdfviewer').pdfviewer('set', 'display_mode', disp_mode);
  }
});
