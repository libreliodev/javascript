#!/bin/bash
#
# extract translatable strings
#

cd ../i18n

find ../src -name "*.java" >files.tmp
find ../www -name "*.jsp" >>files.tmp
xgettext \
	--files-from=files.tmp \
	--from-code=UTF-8 \
	--keyword \
	--keyword=_ \
	--keyword=_h \
	--keyword=_x \
	--language=java \
	--output=../i18n/en.po \
	
mv he.po iw.po
	
../bin/gt4po.py --destlang=af,ar,bg,ca,cs,cy,da,de,el,es,et,fa,fi,fr,ga,hi,hr,hu,id,it,iw,ja,ko,lt,lv,nl,no,pl,pt,ro,ru,sk,sl,sr,sv,th,tl,tr,uk,vi,zh en.po

mv iw.po he.po

../bin/po2intl.py en.po
mv en-intl.po zz.po

for f in *.po
do
	../bin/po2prop.py $f
	mv `basename $f .po`.properties ../src/com/localeplanet/i18n/text/
	../bin/po2json.py $f
	mv `basename $f .po`.json ../www/js/text/
done

rm *.tmp

