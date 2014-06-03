(function($, undefined){
  var arraySlice = Array.prototype.slice,
  default_opts = {
    display_mode: 'book',
    curPageIndex: 1,
    zoom: 1,
    show_selector_fac: 0.5,
    book_mode_fist_page_odd: true,
    auto_select_display_mode: true
  },
  dhtml_global = {
    screen_width: function()
    {
      return $(window).width();
    }, 
    screen_height: function()
    {
      return $(window).height();
    }, 
    canvas_width: function()
    {
      return this.width() || this.prop('width');
    },
    canvas_height: function()
    {
      return this.height() || this.prop('height');
    }
  };
  function wrpFunc(func, thisarg, prepend_args, append_args)
  {
    return function()
    {
      var args = arraySlice.call(arguments);
      return func.apply(thisarg || this, 
                 prepend_args ? prepend_args.concat(args, append_args) :
                                args.concat(append_bargs));
    }
  }
  function funcListCall(a)
  {
    for(var i = 0, l = a.length; i < l; ++i)
    {
      var item = a[i];
      item[1].apply(item[0], item.slice(2));
    }
  }
  function copy_canvas(dest, src, dont_change_size)
  {
    var dest_ctx = dest.getContext('2d');
    if(!dont_change_size)
    {
      dest.width = src.width;
      dest.height = src.height;
      dest_ctx.drawImage(src, 0, 0);
    }
    else
      dest_ctx.drawImage(src, 0, 0, dest.width, dest.height);
  }
  function get_view_scale_for_canvas(view, size, type)
  {
    var canv_w = size.width,
    canv_h = size.height,
    page_w = view[2],
    page_h = view[3],
    b = page_w / page_h > canv_w / canv_h,
    scale;
    switch(type)
    {
    case 'fill':
      scale = b ? canv_h/page_h : canv_w/page_w;
      break;
    default:
      scale = !b ? canv_h/page_h : canv_w/page_w;
    }
    return scale;
  }
  function pdf_viewport_for_canvas(view, size, type)
  {
    var canv_w = size.width,
    canv_h = size.height,
    page_w = view[2] - view[0],
    page_h = view[3] - view[1],
    b = page_w / page_h > canv_w / canv_h,
    scale = get_view_scale_for_canvas(view, size, type);
    var offx = (canv_w - page_w * scale) / 2,
    offy = (canv_h - page_h * scale) / 2;
    return new PDFJS.PageViewport(view, scale, 0, offx, offy);
  }
  function on(el, releaser)
  {
    el.on.apply(el, arraySlice.call(arguments, 2));
    if(releaser)
      releaser.push(([ el, el.off ]).concat(arraySlice.call(arguments, 2)));
    return wrpFunc(arguments.callee, null, [ el, releaser ]);
  }
  function get_render_pages(doc, canvas, o, cb)
  {
    function getPage(i, cb)
    {
      doc.getPage(i).then(function(res) { cb(null, res); }).catch(cb);
    }
    function makeRect(pages)
    {
      switch(o.display_mode)
      {
      case 'book':
        var req_size = [ 0, 0, 0, 0 ],
        len = 0;
        $.each(pages, function(i, page)
          {
            if(page.docPage)
            {
              var view = page.docPage.view;
              page.offset = [ req_size[2], 0 ];
              req_size[2] += view[2] - view[0];
              req_size[3] = Math.max(view[3] - view[1], req_size[3]);
              len++;
            }
            page.scale = 1;
          });
        if(len == 1)
        {
          if(pages[1])
            pages[1].offset = [ req_size[2], 0 ];
          req_size[2] *= 2;
        }
        pages.view = req_size;
        break;
      case 'portrait':
        pages.view = pages[0].docPage.view;
        break;
      }
    }
    var cmds = [],
    ret = [],
    getPages = [];
    switch(o.display_mode)
    {
    case 'book':
      var fodd_effect = (o.book_mode_fist_page_odd ? 1 : 0),
      page_idx = o.curPageIndex - (o.curPageIndex % 2 === fodd_effect ? 1 : 0);
      for(var i = 0; i < 2; ++i)
        ret.push({ index: page_idx + i });
      break;
    case 'portrait':
      ret.push({
        index: o.curPageIndex,
        scale: 1,
        offset: [0, 0]
      });
      break;
    }
    $.each(ret, function(i, p)
      {
        if(p.index > 0 && p.index <= doc.numPages)
          getPages.push(p.index);
      });
    async.map(getPages, getPage, function(err, pages)
      {
        if(err)
          return cb && cb(err);
        var pidx = $.map(pages, function(p) { return p.pageNumber; });
        for(var i = 0, l = ret.length; i < l; ++i)
        {
          var page = ret[i],
          idx = pidx.indexOf(page.index);
          if(idx != -1)
            page.docPage = pages[idx];
        }
        makeRect(ret);
        cb && cb(null, ret);
      });
  }
  function selector_update_active_pages()
  {
    var self = this,
    o = self.data(pvobj_key),
    $el = self.find('.page-selector'),
    pages;
    if(o.curPages)
      pages = $.map(o.curPages, function(page) { return page.index });
    $el.find('.page-item').each(function()
      {
        var $this = $(this),
        idx = parseInt($this.data('page-num'));
        $this.toggleClass('active', pages.indexOf(idx) != -1);
      });  
  }

  function setupAnnotations(doc, page, prect, canvas, $annotationLayerDiv)
  {
    var canvasOffset = $(canvas).offset(),
    annotDivOffset = $annotationLayerDiv.offset(),
    self = this;

    var promise = page.getAnnotations().then(function (annotationsData)
      {
        function createLink(data)
        {
          var rect = data.rect,
          view = page.view,
          element = $('<a>'),
          w_ratio = prect[2] / canvas.width;
          rect = [
            (rect[0] - view[0]) / (view[2] - view[0]) * prect[2],
            prect[3] - (rect[3] - view[1]) / (view[3] - view[1]) * prect[3],
            (rect[2] - view[0]) / (view[2] - view[0]) * prect[2],
            prect[3] - (rect[1] - view[1]) / (view[3] - view[1]) * prect[3]
          ];
          // rect in [x y w h] format
          rect = [
            rect[0] + prect[0] +canvasOffset.left - annotDivOffset.left,
            rect[1] + prect[1] + canvasOffset.top - annotDivOffset.top, 
            rect[2] - rect[0],
            rect[3] - rect[1]
          ];
          element.addClass('annot-link')
            .css({
              position: 'absolute',
              display: 'block',
              left: rect[0],
              top: rect[1],
              width: rect[2],
              height: rect[3]
            });
          if(data.url)
          {
            element.attr('href', data.url)
              .attr('target', '_blank')
              .click(function()
                {
                  var data = {
                    data: data
                  };
                  self.trigger('openlink', [ data ]);
                  return data.return_value;
                });
          }
          else if(data.dest)
          {
            // internal link
            element.attr('href', '#')
              .click(function()
                {
                  try {
                    var dest = typeof data.dest == 'string' ? 
                      dests[data.dest][0] : data.dest[0];
                    doc.getPageIndex(dest).then(function(index)
                      {
                        self.pdfviewer('openPage', index + 1);
                      });
                  }catch(e) {
                  }
                  return false;
                });
          }
          return element;
        }
        var dests;
        doc.getDestinations().then(function(res)
          {
            dests = res;
          });
        for (var i = 0; i < annotationsData.length; i++) {
          var data = annotationsData[i];
          var annotation = PDFJS.Annotation.fromData(data);
          if (!annotation || !annotation.hasHtml()) {
            continue;
          }
          //var element = annotation.getHtmlElement(page.commonObjs);
          data = annotation.getData();
          if(data.subtype !== 'Link')
            continue;
          var element = createLink(data);
          $annotationLayerDiv.append(element);
        }
      });
    return promise;
  }
  function update_canvas_object(doc, canvas, o, cb)
  {
    var self = this;
    if(o.cancelRender)
      return o.cancelRender(function()
        {
          update_canvas_object.call(self, doc, canvas, o, cb);
        });
    var $canvas = $(canvas);
    $canvas.dhtml('item_update', dhtml_global_object(o));
    o.cancelRender = function(cb)
    {
      if(renderTask && !canceled)
        renderTask.cancel()
      oncancelEnd = function()
      {
        o.cancelRender = null;
        cb && cb();
      };
      canceled = true;
    }
    var operation_complete = function(cb, err)
    {
      if(canceled)
        return oncancelEnd && oncancelEnd();
      renderTask = null;
      var args = arraySlice.call(arguments, 1);
      cb.apply(null, args);
    },
    canceled,
    renderTask,
    oncancelEnd;

    async.waterfall([
      function(next)
      {
        get_render_pages(doc, canvas, o, function(err, pages)
          {
            o.curPages = pages;
            operation_complete(next, err, pages);
            if(!o.silent)
              self.trigger('curPages-changed', [ pages ]);
          });
      },
      function(pages, next)
      {
        if(canceled)
          return oncancelEnd && oncancelEnd();
        var context = canvas.getContext('2d'),
        render_series = [];
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        var scale = get_view_scale_for_canvas(pages.view, canvas, 'fit'),
        view = pages.view,
        offx = (canvas.width - view[2]) * scale / 2,
        offy = (canvas.height - view[3]) * scale / 2;
        pages.rect = [ offx, offy, 
                       scale * (view[2] - view[1]), 
                       scale * (view[3] - view[1]) ] ;
        pages.viewport =  new PDFJS.PageViewport(pages.view, scale, 0,
                                                 offx, offy);
        if(!o.silent)
          self.trigger('before-render');

        if(o.links_div)
          $(o.links_div).html('');
        
        $.each(pages, function(i, page)
          {
            var rect = page.rect;
            if(page.docPage)
              render_series.push(function(cb2)
                {
                  var cb = function(err)
                  {
                    operation_complete(cb2, err);
                  };
                  if(canceled)
                    return oncancelEnd && oncancelEnd();
                  var docPage = page.docPage,
                  pview = docPage.view,
                  scale = get_view_scale_for_canvas(view, canvas, 'fit'),
                  offx = (canvas.width - (view[2] - view[0]) * scale) / 2 +
                    page.offset[0] * scale,
                  offy = (canvas.height - (view[3] - view[0]) * scale) / 2 +
                    page.offset[1] * scale;
                  scale = scale * page.scale;
                  var rect = page.rect = [ 
                    Math.ceil(offx), Math.ceil(offy),
                    Math.ceil(scale * (pview[2] - pview[0])), 
                    Math.ceil(scale * (pview[3] - pview[1])) ] ;
                  var viewport = docPage.getViewport(scale);
                  page.viewport = viewport;
                  
                  async.series([
                    function(cb)
                    {
                      var spare_canvas = $('<canvas/>')[0],
                      ctx = spare_canvas.getContext('2d');
                      spare_canvas.width = rect[2];
                      spare_canvas.height = rect[3];
                      renderTask = docPage.render({canvasContext: ctx, 
                                                   viewport: viewport});
                      renderTask.then(function() { callback(); }, callback);
                      function callback(err)
                      {
                        if(!err)
                          context.drawImage(spare_canvas, rect[0], rect[1]);
                        cb(err);
                      }
                    },
                    function(cb)
                    {
                      var el = o.links_div;
                      if(el)
                      {  
                        setupAnnotations.call(self, doc, docPage, rect, 
                                              canvas, $(el))
                          .then(function() { cb() });
                      }
                      else
                        cb();
                    },
                  ], cb);
                });
            });
        
        async.series(render_series, function(err)
          {
            o.cancelRender = null;
            if(!canceled && !o.silent)
              $(self).trigger('render');
            next(err);
          });
      }
    ], cb);
  }
  function dhtml_global_object(o)
  {
    return $.extend({
      pdfviewer: o._pdfviewer_ctx
    }, dhtml_global);
  }
  var string = 'string',
  funcStr = 'function',
  isvisible_str = 'isvisible',
  hidden_str = 'hidden',
  pvobj_key = 'pdfviewer-opts',
  viewer = function(opts)
  {
    if(typeof opts == string)
    {
      if(!methods[opts])
        throw new Error("Undefined function: " + opts);
      var args = arraySlice.call(arguments, 1);
      if(singular_methods.indexOf(opts) == -1)
        return this.each(function()
          {
            methods[opts].apply($(this), args);
          });
      else
        return this.length === 0 ? null : methods[opts].apply(this.eq(0), args);
    }
    return this.each(function()
      {
        var $this = $(this),
        popts = $this.data(pvobj_key);
        if(popts && popts._initialized)
          throw new Error("PDF Viewer is already initialized!");
        $this.data(pvobj_key, $.extend({ _initialized: true }, default_opts));
        if(opts)
          methods.setOptions.call($this, opts);
        var o = $this.data(pvobj_key),
        tmp;
        o._pdfviewer_ctx = {
          next: 'Next',
          previous: 'Previous', 
          option: function(p)
          {
            var o = $this.data(pvobj_key);
            return o[p];
          }
        };
        $this.bind('curPages-changed', function()
          {
            selector_update_active_pages.call($this);
          });
        if(!o.canvas)
          set_methods.canvas.call($this, $('canvas.pdfviewer-canvas')[0]);
        if(!o.links_div)
          $this.pdfviewer('set', 'links_div', $('.links-div')[0]);
        methods.bind_move.call($this);
        methods.init_pagecurl.call($this);
        methods.init_page_selector.call($this);
        methods.update_page_selector.call($this);
        methods.init_resize.call($this);
      });
  },
  set_method_call_update = function(self, o, method)
  {
    if(o._collect_updates)
      o._collect_updates.push(([ self, self.pdfviewer ])
                                .concat(arraySlice.call(arguments, 2)));
    else
      self.pdfviewer.apply(self, arraySlice.call(arguments, 2));
  }
  set_methods = {
    display_mode: function(mode)
    {
      var self = this,
      o = self.data(pvobj_key);
      o.display_mode = mode;
      if(o.canvas && o.pdfDoc)
        set_method_call_update(self, o, 'update_canvas_object', o.pdfDoc, o.canvas);
    },
    pdfDoc: function(doc)
    {
      var self = this,
      o = self.data(pvobj_key);
      o.pdfDoc = doc;
      set_method_call_update(self, o, 'update_page_selector');
      if(o.canvas)
      {
        set_method_call_update(self, o, 'set_canvas_size', null);
        set_method_call_update(self, o, 'update_canvas_object', doc, o.canvas);
      }
    },
    canvas: function(canvas)
    {
      var self = this,
      o = self.data(pvobj_key);
      if(o.canvas_binds_releaser)
        funcListCall(o.canvas_binds_releaser);
      var releaser = o.canvas_binds_releaser = [],
      $canvas = $(canvas),
      page_sel = self.find('.page-selector'),
      click_timeout_id,
      noclick;
      on($canvas, releaser, 'mousemove', function(ev)
        {
          if(this._mousedown)
            noclick = true;
        })
      ('mousedown', function()
       {
         this._mousedown = true;
       })
      ('mouseup', function()
       {
         this._mousedown = false;
       })
      ('click', function()
       {
         if(noclick)
         {
           noclick = false;
           return false;
         }
         if(click_timeout_id === undefined)
           click_timeout_id = setTimeout(function()
             {
               var win_height = $(window).height();
               if(!page_sel.data(isvisible_str))
                 page_sel.fadeIn(500).data(isvisible_str, true)
                 .trigger('visibility-changed');
               else
                 page_sel.fadeOut(500).data(isvisible_str, false)
                 .trigger('visibility-changed');
               click_timeout_id = undefined;
             }, 200);
         return false;
       })
      ('dblclick', function(ev)
       {
         if(click_timeout_id !== undefined)
         {
           clearTimeout(click_timeout_id);
           click_timeout_id = undefined;
         }
         if(!o.curPages || !o.curPages.rect)
           return;
         var offset = self.offset(),
         rect = o.curPages.rect,
         relX = (ev.pageX - rect[0] - offset.left) / rect[2],
         relY = (ev.pageY - rect[1] - offset.top) / rect[3];
         if(o.zoom > 1)
           o.zoom = 1;
         else
           o.zoom = 2;
         self.trigger('sizechanged');
         self.bind('before-render', function()
           {
             var rect = o.curPages ? o.curPages.rect : null;
             if(o.zoom > 1 && rect)
             {
               self.prop('scrollLeft', rect[0] +
                         rect[2] * relX - $(window).width()/2);
               self.prop('scrollTop', rect[1] +
                         rect[3] * relY - $(window).height()/2);
             }
             self.unbind('before-render', arguments.callee);
           });
         return false;
       });
      o.canvas = canvas;
      if(o.pdfDoc)
      {
        set_method_call_update(self, o, 'set_canvas_size', null);
        set_method_call_update(self, o, 'update_canvas_object', o.pdfDoc, canvas);
      }
    }
  },
  get_methods = {
    pageIndexWithOffset: function(offset)
    {
      var o = this.data(pvobj_key),
      curPageIndex = o.curPageIndex,
      curPages = o.curPages;
      if(o.pdfDoc && o.curPages)
      {
        switch(o.display_mode)
        {
        case 'book':
          var off = 1;
          if(o.book_mode_fist_page_odd)
            off = 0;
          curPageIndex -= (curPageIndex - off) % curPages.length;
          if(curPageIndex === 0 && o.book_mode_fist_page_odd)
            curPageIndex = 1;
          break;
        default:
          curPageIndex -= (curPageIndex - 1) % curPages.length;
        }
        var page = curPageIndex + curPages.length * offset;
        if(page === 0 && o.book_mode_fist_page_odd)
          page = 1;
        if(page > 0 && page <= o.pdfDoc.numPages)
          return page;
      }
      return false;
    }
  },
  singular_methods = viewer.singular_methods = [ 'get' ],
  methods = viewer.method = {
    init_pagecurl: function()
    {
      var self = this,
      o = self.data(pvobj_key),
      ev_box = {};
      
      self.on('render', pagecurl_start)
        .on('before-render', pagecurl_destroy);
      function pagecurl_destroy()
      {
        $(ev_box).trigger('clear');
      }
      function pagecurl_start()
      {
        if(o.display_mode !== 'book')
          return;
        render_nearby_pages(function(err, pages_obj)
          {
            if(err)
              return;
            init_pagecurls(pages_obj[0], pages_obj[1]);
            self.trigger('pagecurl-initialized');
          });
      }
      function render_page(idx, cb2)
      {
        if(!exists(idx))
          return cb2();
        function exists(idx)
        {
          return idx > 0 && idx <= o.pdfDoc.numPages;
        }
        function cb(err)
        {
          $(ev_box).unbind('clear', cancelRender);
          cb2(err, p_opts);
        }
        function cancelRender()
        {
          if(p_opts.cancelRender)
            p_opts.cancelRender();
          cb('Canceled!');
        }
        var spare_canvas = $('<canvas/>')[0],
        p_opts = {
          canvas: spare_canvas,
          curPageIndex: idx,
          display_mode: o.display_mode,
          links_div: o.links_div ? $(o.links_div).clone()[0] : null,
          zoom: o.zoom,
          silent: true,
          book_mode_fist_page_odd: o.book_mode_fist_page_odd
        };
        spare_canvas.width = o.canvas.width;
        spare_canvas.height = o.canvas.height;
        $(ev_box).bind('clear', cancelRender);
        update_canvas_object.call(self, o.pdfDoc, spare_canvas, p_opts,
                                  function()
          {
            cb(null, p_opts);
          });
      }
      function render_nearby_pages(cb)
      {
        async.mapSeries([ self.pdfviewer('get', 'pageIndexWithOffset', -1),
                          self.pdfviewer('get', 'pageIndexWithOffset', 1) ], 
                        render_page, cb);
      }
      function init_pagecurls(prev_page, next_page)
      {
        var pagecurls = [],
        pagecurl_data = o.pagecurl_data = {},
        display_mode = o.display_mode,
        canvas = o.canvas,
        ctx = canvas.getContext('2d'),
        curPages = o.curPages,
        spare_canvas = $('<canvas/>')[0],
        releaser = [],
        pc_default_opts = {
          canvas: canvas,
          grabbable: true,
          corner_epsilon_x: canvas.width/15,
          corner_epsilon_y: canvas.width/15
        },
        rendering;
        copy_canvas(spare_canvas, canvas);
        on($(ev_box), releaser, 'clear', destroy);
        pagecurl_data.curlpage = function(pagecurl, cb)
        {
          var curl_corners = [ 'bl', 'br' ];
          for(var i = 0, l = curl_corners.length; i < l; ++i)
          {
            var corner = curl_corners[i];
            if(pagecurl.corners.indexOf(corner) != -1)
            {
              pagecurl.curlpage(corner, cb);
              return true;
            }
          }
          return false;
        }
        function destroy()
        {
          $.each(pagecurls, function(i, pc)
            {
              pc.destroy();
            }); 
          funcListCall(releaser);
          $(o.links_div).show();
          o.pagecurl_data = null;
        }
        function pagecurl_grab()
        {
          $(o.links_div).hide();
          $.each(pagecurls, function(i, pc)
            {
              pc._grabbable = pc.grabbable;
              pc.grabbable = false;
            });
        }
        function pagecurl_grabend()
        {
          $(o.links_div).show();
          $.each(pagecurls, function(i, pc)
            {
              pc.grabbable = pc._grabbable;
            });
        }
        function page_curled()
        {
          // goto next page
          var page_data = this.page_data
          o.curPageIndex = page_data.curPageIndex;
          o.curPages = page_data.curPages;
          $(o.links_div).replaceWith(page_data.links_div);
          o.links_div = page_data.links_div;
          copy_canvas(spare_canvas, canvas);
          self.trigger('curPages-changed', [ o.curPages ]);
          copy_canvas(canvas, spare_canvas, true);
          pagecurl_destroy();
          pagecurl_start();
        }
        function handle_before_render()
        {
          if(rendering)
            return;
          rendering = true;
          var pc_rendering = this;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          $.each(pagecurls, function(i, pc)
            {
              if(pc != pc_rendering)
                pc.render();
            });
          rendering = false;
        }
        switch(display_mode)
        {
        case 'book':
          var pages_opts = [
            {
              corners: [ 'tl', 'bl', ],
              limits: [ 'tr', 'br' ],
            },
            {
              corners: [ 'tr', 'br' ],
              limits: [ 'tl', 'bl', ]
            }
          ];
          for(var i = 0; i < 2; ++i)
          {
            var curPage = curPages[i],
            rect = curPage.rect,
            page_data = i === 0 ? prev_page : next_page;
            if(!curPage || !curPage.rect)
              continue;
            var pages = page_data ? page_data.curPages : null, 
            rect0 = null, rect1 = null;
            if(pages)
            {
              rect0 = i === 0 ? pages[0].rect : pages[1].rect;
              rect1 = i === 0 ? pages[1].rect : pages[0].rect;
            }
            var pagecurl = new PageCurl(
              $.extend({}, pages_opts[i], pc_default_opts,{
                page_data: page_data,
                rect: rect,
                src0: rect0 ? {
                  image: page_data.canvas,
                  src_rect: rect0
                } : null,
                src1: rect1 ? {
                  image: page_data.canvas,
                  src_rect: rect1
                } : null,
                src2: {
                  image: spare_canvas,
                  src_rect: rect
                },
                grabbable: !!pages
              }));
            if(i == 0)
              pagecurl_data.previous = pagecurl;
            else
              pagecurl_data.next = pagecurl

            on($(pagecurl), releaser, 'grab', pagecurl_grab)
            ('grabend', pagecurl_grabend)
            ('page-curled', page_curled)
            ('before-render', handle_before_render);
            
            pagecurls.push(pagecurl);
          }
          break;
        }
      }
    },
    pagecurl_to: function(page)
    {
      function continue_job()
      {
        var pagecurl_data = o.pagecurl_data,
        pagecurl = page == 'next' ? pagecurl_data.next : pagecurl_data.previous;
        if(pagecurl && pagecurl.grabbable)
        {
            if(!pagecurl_data.curlpage(pagecurl, function()
                {
                  o.__waiting_for_curlpage = false;
                }))
              o.__waiting_for_curlpage = false;
        }
        else
          o.__waiting_for_curlpage = false;
      }
      var self = this,
      o = self.data(pvobj_key);
      if(o.__waiting_for_curlpage)
        return;
      console.log(o.pagecurl_data);
      o.__waiting_for_curlpage = true;
      if(!o.pagecurl_data)
        self.bind('pagecurl-initialized', function()
          {
            continue_job();
            self.unbind('pagecurl-initialized', arguments.callee);
          });
      else
        continue_job();
    },
    init_resize: function()
    {
      var self = this,
      o = self.data(pvobj_key),
      w = self.width(),
      h = self.height(),
      redraw_timeout = 2000,
      redraw_tm,
      zoom = o.zoom,
      dhtml_ctx = [ dhtml_global_object(o) ];
      resize_update();
      if(o.canvas)
        self.pdfviewer('set_canvas_size');
      on($(window), null, 'resize', resize_handle);
      on(self, null, 'sizechanged', sizechanged_handle)
        ('curPages-changed', function init_size_curpages_changed(ev, pages)
          {
            var vp = pdf_viewport_for_canvas(pages.view, {width:w,height:h},
                                             'fit');
            self.pdfviewer('set_canvas_size', vp);
          });
      function sizechanged_handle()
      {
        resize_update();
        if(o.pdfDoc && o.canvas)
          self.pdfviewer('update_canvas_object', o.pdfDoc, o.canvas);
        w = self.width();
        h = self.height();
      }
      function resize_handle(ev)
      {
        resize_update();
        var nw = self.width(),
        nh = self.height();
        if(w != nw || h != nh || zoom != o.zoom)
        {
          if(redraw_tm !== undefined)
            clearTimeout(redraw_tm);
          redraw_tm = setTimeout(function()
            {
              if(o.pdfDoc && o.canvas)
                self.pdfviewer('update_canvas_object', o.pdfDoc, o.canvas);
              else if(o.canvas)
                self.pdfviewer('set_canvas_size');
              redraw_tm = undefined;
            }, redraw_timeout);
        }
        w = nw;
        h = nh;
        zoom = o.zoom;
      }
      function resize_update()
      {
        self.dhtml('eval', self.data('resize'), dhtml_ctx);
        // hack for removing scrollbars
        self.css('overflow', o.zoom > 1 ? '' : 'hidden');
        
        if(o.auto_select_display_mode && o.canvas)
        {
          var mode = o.display_mode,
          canvas = o.canvas,
          width = self.width(),
          height = self.height(),
          rect = o.curPages && o.curPages[0] ? 
            o.curPages[0].rect : null,
          ratio = rect ? 2 * rect[2] / rect[3] : 1.5;
          if(width / height < ratio)
            o.display_mode = 'portrait';
          else
            o.display_mode = 'book';
        }
      }
    },
    set_canvas_size: function(size)
    {
      var self = this,
      o = self.data(pvobj_key),
      canvas = o.canvas;
      if(size)
      {
        canvas.width = Math.max(size.width * o.zoom, self.width());
        canvas.height = Math.max(size.height * o.zoom , self.height());
      }
      else
      {
        canvas.width = self.width() * o.zoom;
        canvas.height = self.height() * o.zoom;
      }
    },
    init_page_selector: function()
    {
      var self = this,
      o = self.data(pvobj_key),
      $el = self.find('.page-selector'),
      releaser = o._page_selector_releaser,
      pages_prev = $el.find('.pages-preview');
      pages_prev.dhtml('list_init');
      o._page_sel_height = $el.height();
      $el.hide();
      if(releaser)
        funcListCall(releaser);
      releaser = [];
      on($el, releaser, 'click', '.page-item', function()
        {
          var pdfDoc = o.pdfDoc;
          if(!pdfDoc || !o.curPages || this.parentNode._scrolled)
            return false;
          var page_idx = parseInt($(this).data('page-num'));
          if(page_idx > 0 && page_idx <= pdfDoc.numPages)
          {
            self.pdfviewer('openPage', page_idx);
          }
          return false;
        });
      on(pages_prev, releaser, 'scroll', pages_prev_track_visibility)
      ('mousedown', function(ev)
        {
          this._mousedown = true;
          this._mousedown_data = { mX: ev.pageX, scrollX: this.scrollLeft };
        })
      ('mouseup', function()
        {
          var self = this;
          self._mousedown = false;
          setTimeout(function()
            {
              self._scrolled = undefined;
            }, 0);
        })
      ('mousemove', function(ev)
        {
          var md_data = this._mousedown_data;
          if(this._mousedown)
          {
            this.scrollLeft = md_data.scrollX - (ev.pageX - md_data.mX);
            this._scrolled = true;
          }
        });
      on($el, releaser, 'visibility-changed', pages_prev_track_visibility);
      pages_prev_track_visibility()
      function pages_prev_track_visibility()
      {
        pages_prev.each(function()
          {
            var $this = $(this),
            width = $this.width(),
            offsetX = $this.offset().left,
            list_visible = $el.data(isvisible_str);
            $this.find(' > li').each(function()
              {
                var $el = $(this),
                offx = $el.offset().left - offsetX,
                w = $el.width(),
                was_visible = $el.data(isvisible_str),
                p0 = offx,
                p1 = offx + w,
                visible = list_visible && w && 
                  ((p0 > 0 && p0 < width) || (p1 > 0 && p1 < width));
                if(visible != was_visible)
                {
                  $el.data(isvisible_str, visible);
                  $el.trigger('visibility-changed');
                }
              });
          });
      }
    },
    bind_move: function()
    {
      var self = this;
      on(self, null, 'mousemove', function(ev)
        {
          if(self.css('overflow') == 'hidden')
            return;
          // scroll
          var el = this,
          md_data = el._mousedown_data;
          if(el._mousedown)
          {
            el.scrollLeft = md_data.scrollX - (ev.pageX - md_data.mX);
            el.scrollTop = md_data.scrollY - (ev.pageY - md_data.mY);
            el._scrolled = true;
          }
        })
      ('mousedown', function(ev)
        {
          var el = this;
          el._mousedown = true;
          el._mousedown_data = {
            mX: ev.pageX,
            mY: ev.pageY,
            scrollX: el.scrollLeft,
            scrollY: el.scrollTop
          };
        })
      ('mouseup', function()
        {
          var el = this;
          el._mousedown = false;
          setTimeout(function() { el._scrolled = undefined; });
        });
    },
    openPage: function(index)
    {
      var self = this,
      o = self.data(pvobj_key);
      o.curPageIndex = index;
      if(o.canvas && o.pdfDoc)
        self.pdfviewer('update_canvas_object', o.pdfDoc, o.canvas);
    },
    update_page_selector: function()
    {
      function update_page(i)
      {
        var item = {
          draw_page_when_visible: function(type)
          {
            var $canvas = this,
            canvas = $canvas[0],
            rendered;
            li.bind('visibility-changed', function(ev)
              {
                var visible = $(this).data(isvisible_str);
                if(visible && !rendered)
                  draw_page();
              });
            function draw_page()
            {
              pdfDoc.getPage(i).then(function(page)
                {
                  var viewport, context;
                  try {
                    viewport = pdf_viewport_for_canvas(page.view, canvas, type);
                    context = canvas.getContext('2d');
                  } catch(e) {
                    console.error(e);
                  } finally {
                    page.render({canvasContext: context, viewport: viewport});
                  }
                });
            }
          },
          page_number: i
        };
        var li = pp.dhtml('list_new_item', null);
        li.attr('data-page-num', item.page_number+'');
        pp.append(li);
        li.dhtml('list_items_update', [ item, dhtml_global_object(o) ]);
      }
      var self = this,
      $el = self.find('.page-selector'),
      pp = $el.find('.pages-preview'),
      o = self.data(pvobj_key),
      pdfDoc = o.pdfDoc;
      pp.html('');
      if(!pdfDoc || pp.length === 0)
        return;
      for(var i = 1, len = pdfDoc.numPages; i <= len; ++i)
        update_page(i);
      
      var v = $el.css('display') != 'none';
      if(!v)
        $el.show();
      o._page_sel_height = $el.height();
      if(!v)
        $el.hide();
    },
    reupdate_canvas_object: function(doc, canvas, cb)
    {
      function update()
      {
        self.pdfviewer('update_canvas_object', doc, canvas, cb);
      }
      var self = this,
      o = self.data(pvobj_key); 
      if(o.cancelRender)
        o.cancelRender(update);
      else
        update();
    },
    update_canvas_object: function(doc, canvas, cb)
    {
      var self = this,
      o = self.data(pvobj_key);
      update_canvas_object.call(self, doc, canvas, o, function(err)
        {
          if(err)
            console.error(err);
          cb && cb.apply(self, arguments);
        });
    },
    get: function(prop)
    {
      if(get_methods[prop])
        return get_methods[prop]
                  .apply(this, arraySlice.call(arguments, 1));
      var o = this.data(pvobj_key);
      return o[prop];
    },
    set: function(prop, val)
    {
      if(set_methods[prop])
        return set_methods[prop]
                  .apply(this, arraySlice.call(arguments, 1));
      var o = this.data(pvobj_key);
      return o[prop] = val;
    },
    setOptions: function(opts)
    {
      var o = this.data(pvobj_key);
      var funcs = o._collect_updates = [];

      for(var i in opts)
        methods.set.call(this, i, opts[i]);

      var unique_names = [],
      tmp = [];
      for(var c = funcs.length - 1; c >= 0; --c)
      {
        var func = funcs[c];
        if(unique_names.indexOf(func[2]) == -1)
          tmp.unshift(func);
        unique_names.push(func[2]);
      }
      funcListCall(tmp);
      o._collect_updates = null;
    }
  };
  $.fn.pdfviewer = viewer;
  $(function(){
    $('.pdfviewer').pdfviewer();
  })
})(jQuery);
