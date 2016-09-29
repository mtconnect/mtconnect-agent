#!/bin/sh

TOOLS_DIR="C:/tools/libxml"

if [ ! -d $TOOLS_DIR ]; then
	echo "Create $TOOLS_DIR"
	mkdir -p "$TOOLS_DIR"
fi

cd "$TOOLS_DIR"

echo "Downloading libxml binaries ..."

for f in iconv-1.9.2 libxml2-2.7.8 libxslt-1.1.26 zlib-1.2.5
do
	curl --remote-name "ftp://ftp.zlatkovic.com/libxml/$f.win32.zip"
	unzip "$f".win32.zip

	if [ "$f" == zlib-1.2.5 ]; then
		cp "$f"/bin/* .
	else
		cp "$f".win32/bin/* .
	fi
done
