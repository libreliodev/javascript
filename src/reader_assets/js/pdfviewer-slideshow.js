$(function(){
  var img_exts = [ '.png', '.gif', '.jpg', '.jpeg' ],
  pdf_viewer = $('.pdfviewer');
  pdf_viewer.bind('render-link', function(ev, data, page)
     {
       function init_slideshow()
       {
         if(exit_proc)
           return;

         for(var i = start, l = end + 1; i < l; ++i)
         {
           var s = path.join(file_dirname, file_basename + '_' + i + file_ext),
           img = $('<img/>'),
           li = $('<li/>');
           img.prop('src', s);
           $slides.append(li.append(img));
         }

         $slides_wrp.on('click', '.flex-pauseplay', function()
           {
             if(query.warect == 'full' && screenfull.enabled)
             {
               pdf_viewer.pdfviewer('set', 'auto_resizable', false);
               screenfull.request($slides_wrp[0]);
               setTimeout(function()
                 {
                   pdf_viewer.pdfviewer('set', 'auto_resizable', true);
                 }, 500);
             }
           });
         
         $slides_wrp.append($slides)
           .flexslider({
             animation: 'slide',
             pausePlay: true,
             slideshowSpeed: 7000, //Integer: Set the speed of the slideshow cycling, in milliseconds
             animationSpeed: 600, //Integer: Set the speed of animations, in milliseconds
             controlNav: false
           });
         $slides_wrp.flexslider('pause');
         if(query.waplay == 'auto')
           $slides_wrp.flexslider('play');
       }
       var url_str = data.url,
       url_path = url('path', url_str),
       file_ext = path.extname(url_path);
       // image file
       if(img_exts.indexOf(file_ext.toLowerCase()) != -1)
       {
         var query = querystring.parse(url('?', url_str)),
         qm_idx = url_str.indexOf('?'),
         src = qm_idx == -1 ? url_str : url_str.substring(0, qm_idx),
         $slides_wrp = $('<div/>').addClass('slideshow').addClass('flexslider'),
         $slides = $('<ul/>').addClass('slides'),
         rect = data.rect,
         releaser = [],
         file_dirname = path.dirname(url_path),
         file_basename = path.basename(url_path, file_ext),
         tmp = file_basename.split('_'),
         start = 1,
         end = tmp.length > 1 ? parseInt(tmp[tmp.length - 1]) : NaN,
         exit_proc, initialized;
         if(isNaN(end) || end < start)
           return;
         file_basename = tmp.slice(0, tmp.length - 1).join('_');
         
         rect[2] *= 4;
         rect[3] *= 4;
         $slides_wrp.css({
           position: 'absolute',
           left: rect[0],
           top: rect[1],
           width: rect[2],
           height: rect[3]
         });
         on($slides_wrp, null, 'click', false)
         ('mousedown', false)
         ('mouseup', false);
         on(pdf_viewer, releaser, 'pagecurl-start', function()
           {
             $slides_wrp.animate({ opacity: 0 }, {
               queue: false,
               duration: 200
             });
           })
         ('pagecurl-end', function()
           {
             $slides_wrp.animate({ opacity: 1 }, {
               queue: false,
               duration: 200
             });
           })
         ('curPages-changed', function(ev, curPages)
          {
            if(!initialized && curPages.indexOf(page) != -1)
            {
              init_slideshow()
              return;
            }
            exit_Proc = true;
            $slides_wrp.remove();
            funcListCall(releaser);
          });
         data.element = $slides_wrp[0];
         var curPages = pdf_viewer.pdfviewer('get', 'curPages');
         if(curPages.indexOf(page) != -1)
         {
           init_slideshow();
           initialized = true;
         }
       }
     })
});
