$(function(){
  function webframe_url(s)
  {
    var idx = (s+'').lastIndexOf('?');
    return idx == -1 ? s : s.substr(0, idx);
  }
  function is_webframe(s)
  {
    var protos = [ 'http:', 'https:' ],
    proto = url_protocol(s);
    if(s === undefined || proto === null || protos.indexOf(proto) == -1)
      return false;
    return true;
/*
    var query = querystring.parse(librelio_url_query(s));
    for(var i in query)
      if(i.indexOf('wa') === 0)
        return true;
    return false;*/
  }
  function $element_toggle_visibility($el, b)
  {
    if(b)
      $el.show();
    else
      $el.hide();
  }
  
  var options_default = {
    rect: 'full'
  },
  pdf_viewer = $('.pdfviewer');
  
  pdf_viewer.bind('render-link', function(ev, data, page)
     {
       var url_str = data.url,
       query = querystring.parse(librelio_url_query(url_str));

       if(is_webframe(url_str) && !data.element)
       {
         var data_wa = data.wa = {};
         for(var i in query)
         {
           if(i.indexOf('wa') === 0)
           {
             var i2 = i.substr(('wa').length);
             data_wa[i2] = query[i] || options_default[i2];
           }
         }
         if(data_wa.play == 'auto')
         {
           data.element = $('<div/>')[0];
           webFrameInit(data, page);
         }
       }
     })
   .bind('openlink', function(ev, obj, page)
     {
       var data = obj.data,
       url_str = data.url;
       if(is_webframe(url_str) && obj.return_value !== false)
       {
         var el = data.element._frame_el || $('<div/>')[0];
         el._link_el = data.element;
         if(!data.element._frame_el)
         {
           $(data.element.parentNode).append(el);
           if(data.wa.rect == 'full')
             $element_toggle_visibility($(data.element), false);
           data.element._frame_el = el;
           data.element = el;
           webFrameInit(data, page);
         }
         else
         {
           // this block of code is only for warect=full
           $element_toggle_visibility($(data.element), false);
           $element_toggle_visibility($(el), true);
           data.element = el;
           if(data.wa.rect == 'full')
             el.toggleFullWindow(true);
         }
         obj.return_value = false;
       }
     });
  function webFrameInit(data, page)
  {
    function update_frame_size()
    {
      var width = $frame_wrp.width(),
      height = $frame_wrp.height();
      if($frame)
        $frame.attr('width', width)
        .attr('height', height);
      /*if($close_btn)
        $close_btn.css({
          width: width,
          height: height
        });*/
    }
    function toggleFullWindow(b)
    {
      b = typeof b == 'undefined' ? !$frame_wrp.hasClass('fullscreen-view') : b;
      $('body').toggleClass('in-fullscreen-view', b);
      $frame_wrp.toggleClass('fullscreen-view', b);
      setTimeout(function()
        {
          update_frame_size();
        });
    }
    function init_frame()
    {
      if(initialized)
        return;
      initialized = true;
      if(data_wa.rect == 'full')
        toggleFullWindow(true);
      $frame = $('<iframe/>')
        .appendTo($frame_wrp);
      $frame.css({
        border: 'none'
      });
      $frame.prop('src', webframe_url(data.url));
      
      if(data_wa.rect == 'full')
      {
        $close_btn = $('<div/>').addClass('webframe-close-btn')
          .appendTo($frame_wrp)
          .append('<span class="glyphicon glyphicon-remove"></span>');
        $close_btn.click(function()
          {
            switch_to_link();
            toggleFullWindow(false);
            $close_btn.remove();
          });
      }
      update_frame_size();
      on($(window), releaser, 'resize', update_frame_size);
    }
    function switch_to_link()
    {
      if($frame_wrp[0]._link_el)
      {
        // remove frame
        // recreate it after clicking on link again
        var link_el = $frame_wrp[0]._link_el;
        link_el._frame_el = null;
        $frame_wrp.remove();
        //$element_toggle_visibility($frame_wrp, false);
        $element_toggle_visibility($(link_el), true);
        data.element = link_el;
      }
    }
    data.element.toggleFullWindow = toggleFullWindow;
    var data_wa = data.wa,
    $frame_wrp = $(data.element),
    rect = data.rect,
    $frame, $close_btn,
    releaser = [],
    initialized,
    curPages = pdf_viewer.pdfviewer('get', 'curPages');
    $frame_wrp.css({
      position: 'absolute',
      left: rect[0],
      top: rect[1],
      width: rect[2],
      height: rect[3]
    });
    if(curPages.indexOf(page) != -1)
      init_frame();
    on($frame_wrp, null, 'click', false)
    ('mousedown', false)
    ('mouseup', false);
    on(pdf_viewer, releaser, 'pagecurl-start', function()
      {
        $frame_wrp.animate({ opacity: 0 }, {
          queue: false,
          duration: 200
        });
      })
    ('pagecurl-end', function()
      {
        $frame_wrp.animate({ opacity: 1 }, {
          queue: false,
          duration: 200
        });
      })
    ('curPages-changed', function(ev, curPages)
      {
        if(curPages.indexOf(page) != -1)
          return init_frame();
        $frame_wrp.remove();
        funcListCall(releaser);
      });
  }

});
