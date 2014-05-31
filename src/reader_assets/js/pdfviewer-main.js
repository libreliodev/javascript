$(function(){
  var doc_query = querystring.parse(get_url_query(document.location+'')),
  pdf_url = doc_query ? doc_query.waurl : null,
  external_b = doc_query ? typeof doc_query.external != 'undefined' : null,
  pdf_viewer = $('.pdfviewer');
  if(pdf_url)
  {
    if(!external_b)
      pdf_url = s3bucket_file_url(pdf_url);
    PDFJS.getDocument(pdf_url).then(function(pdf)
      {
        try {
          pdf_viewer.pdfviewer('set', 'pdfDoc', pdf);
        }catch(e) {
          console.error(e);
        }
      })
      .catch(function(err)
        {
          notifyError(err);
        });
  }
  
  $('.next-btn').click(function()
    {
      var curPageIndex = pdf_viewer.pdfviewer('get', 'curPageIndex'),
      curPages = pdf_viewer.pdfviewer('get', 'curPages'),
      pdfDoc = pdf_viewer.pdfviewer('get', 'pdfDoc');
      if(pdfDoc && curPages && 
         curPageIndex + curPages.length <= pdfDoc.numPages)
      {
        pdf_viewer.pdfviewer('openPage', curPageIndex + curPages.length);
      }
      return false;
    });
  $('.previous-btn').click(function()
    {
      var curPageIndex = pdf_viewer.pdfviewer('get', 'curPageIndex'),
      curPages = pdf_viewer.pdfviewer('get', 'curPages'),
      pdfDoc = pdf_viewer.pdfviewer('get', 'pdfDoc');
      if(pdfDoc && curPages && 
         curPageIndex - curPages.length > 0)
      {
        pdf_viewer.pdfviewer('openPage', curPageIndex - curPages.length);
      }
      return false;
    });
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
/*
  Var canvas = $('canvas')[0];
  
  $(document).on('mousemove', function(ev)
    {
      var x = ev.pageX,
      y = ev.pageY;
      try {
      bookify.render_page(canvas, null, null, {
        dest_rect: [ 0, 0, $(window).width(), $(window).height() ],
        image: { }
      }, null, 'tl', [x, y]);
      }catch(e) { console.error(e); }
      var ctx = canvas.getContext('2d');
      var angle = Math.atan2(x, y),
      x0 = y / Math.tan(angle),
      y0 = x / Math.tan(Math.PI/2 - angle);
      var spineBottomToFollowerAngle = Math.atan2(y, x);

			var radiusLeft = Math.cos(spineBottomToFollowerAngle) * canvas.width;
			//var radiusTop = Math.sin(spineBottomToFollowerAngle) * canvas.height;
      x0 = radiusLeft;
      y0 = 100;
      //ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#00ff00';
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(0, y0);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.stroke();
    });
  */
  function s3bucket_file_url(key)
  {
    return '//' + config.s3Bucket + '.s3.amazonaws.com/' + key;
  }
});
