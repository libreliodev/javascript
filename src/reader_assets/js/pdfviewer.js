(function($, undefined){
  var arraySlice = Array.prototype.slice,
  default_opts = {
    display_mode: 'book',
    curPageIndex: 1,
    zoom: 1,
    show_selector_fac: 0.5
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
    page_w = view[2],
    page_h = view[3],
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
      releaser.push(([ el, 'off' ]).concat(arraySlice.call(arguments, 2)));
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
              req_size[2] += view[2];
              req_size[3] = Math.max(view[3], req_size[3]);
              len++;
            }
            page.scale = 1;
          });
        if(len == 1)
          req_size[2] *= 2;
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
      var page_idx = o.curPageIndex - (o.curPageIndex % 2 === 0 ? 1 : 0);
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

  function setupAnnotations(doc, page, viewport, canvas, $annotationLayerDiv)
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
          transform = viewport.transform;
          element.addClass('annot-link')
            .css({
              position: 'absolute',
              display: 'block',
              left: rect[0] + canvasOffset.left - annotDivOffset.left,
              top: rect[1] + canvasOffset.top - annotDivOffset.top, 
              // something is wrong with zoom feature
              width: rect[2] - rect[0],
              height: rect[3] - rect[1],
              transform: 'matrix(' + transform.join(',') + ')',
              transformOrigin: -rect[0] + 'px ' + -rect[1] + 'px'
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
                  if(dests[data.dest])
                    doc.getPageIndex(dests[data.dest][0]).then(function(index)
                      {
                        self.pdfviewer('openPage', index + 1);
                      });
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
      if(renderTask && renderTask.cancel && !canceled)
        renderTask.cancel()
      oncancelEnd = function()
      {
        o.cancelRender = null;
        cb();
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
        offx = (canvas.width - pages.view[2] * scale) / 2,
        offy = (canvas.height - pages.view[3] * scale) / 2;
        pages.viewport =  new PDFJS.PageViewport(pages.view, scale, 0,
                                                 offx, offy);
        
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
                  scale = get_view_scale_for_canvas(pages.view, canvas, 'fit'),
                  offx = (canvas.width - pages.view[2] * scale) / 2 +
                    page.offset[0] * scale,
                  offy = (canvas.height - pages.view[3] * scale) / 2 +
                    page.offset[1] * scale,
                  viewport =  new PDFJS.PageViewport(docPage.view, 
                                                     scale * page.scale, 0, 
                                                     offx, offy);
                  page.viewport = viewport;
                  
                  async.series([
                    function(cb)
                    {
                      renderTask = docPage.render({canvasContext: context, 
                                                   viewport: viewport})
                        .then(function() { cb(); })
                        .catch(cb);
                    },
                    function(cb)
                    {
                      var el = o.links_div;
                      if(el)
                      {  
                        setupAnnotations.call(self, doc, docPage, viewport, 
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
  visible_str = 'visible',
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
      page_sel = self.find('.page-selector');
      on($canvas, releaser, 'mousemove', function(ev)
         {
           var win_height = $(window).height();
           if(o.show_selector_fac * o._page_sel_height > 
              win_height - ev.clientY)
           {
             if(!page_sel.data(visible_str))
               page_sel.fadeIn(500).data(visible_str, true)
                 .trigger('visibility-changed');
           }
           else if(page_sel.data(visible_str))
             page_sel.fadeOut(500).data(visible_str, false)
               .trigger('visibility-changed');
         })
      ('mousedown', function()
       {
         
       })
      ('mouseup', function()
       {
         
       })
      ('click', function()
       {
         
       })
      ('dblclick', function(ev)
       {
         var offset = self.offset(),
         viewport = o.curPages ? o.curPages.viewport : null,
         relX = (ev.pageX - viewport.offsetX - offset.left) / viewport.width,
         relY = (ev.pageY - viewport.offsetY - offset.top) / viewport.height;
         if(o.zoom > 1)
           o.zoom = 1;
         else
           o.zoom = 2;
         self.trigger('sizechanged');
         self.bind('before-render', function()
           {
             var viewport = o.curPages ? o.curPages.viewport : null;
             if(o.zoom > 1 && viewport)
             {
               self.prop('scrollLeft', viewport.offsetX +
                         viewport.width * relX - $(window).width()/2);
               self.prop('scrollTop', viewport.offsetY +
                         viewport.height * relY - $(window).height()/2);
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

  },
  singular_methods = viewer.singular_methods = [ 'get' ],
  methods = viewer.method = {
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
          if(!pdfDoc || !o.curPages)
            return false;
          var page_idx = parseInt($(this).data('page-num'));
          if(page_idx > 0 && page_idx <= pdfDoc.numPages)
          {
            self.pdfviewer('openPage', page_idx);
          }
          return false;
        });
      on(pages_prev, releaser, 'scroll', pages_prev_track_visibility);
      on($el, releaser, 'visibility-changed', pages_prev_track_visibility);
      pages_prev_track_visibility()
      function pages_prev_track_visibility()
      {
        pages_prev.each(function()
          {
            var $this = $(this),
            width = $this.width(),
            scrollX = $this.prop('scrollLeft'),
            offsetX = $this.offset().left,
            list_visible = $this.css('display') != 'none' && 
              $this.css('visible') != 'hidden';
            
            $this.find(' > li').each(function()
              {
                var $el = $(this),
                offx = $el.offset().left - offsetX,
                w = $el.width(),
                was_visible = $el.data('isvisible'),
                p0 = offx - scrollX,
                p1 = offx + w - scrollX,
                visible = list_visible && w && 
                  ((p0 > 0 && p0 < width) || (p1 > 0 && p1 < width));
                if(visible != was_visible)
                {
                  $el.data('isvisible', visible);
                  $el.trigger('visibility-changed');
                }
              });
          });
      }
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
            draw_cmd_sent;
            li.bind('visibility-changed', function(ev)
              {
                if($(this).data('isvisible') && !draw_cmd_sent)
                  draw_page();
              });
            function draw_page()
            {
              draw_cmd_sent = true;
              pdfDoc.getPage(i).then(function(page)
                {
                  var viewport, context;
                  try {
                    viewport = pdf_viewport_for_canvas(page.view, canvas, type);
                    context = canvas.getContext('2d');
                  }catch(e) {
                    console.error(e);
                  }
                  finally {
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
