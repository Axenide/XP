BINARY      := webview
DIST        := dist
LDFLAGS     := -s -w
PKG_CONFIG  := pkg-config

LINUX_PKG_CONFIG_DEPS  := gtk+-3.0 webkit2gtk-4.1

.PHONY: all linux amd64 arm64 release run clean check

all: linux

check:
	@command -v $(PKG_CONFIG) >/dev/null || { echo "pkg-config not found"; exit 1; }
	@for pkg in $(LINUX_PKG_CONFIG_DEPS); do \
		$(PKG_CONFIG) --exists $$pkg || { echo "missing: $$pkg"; exit 1; }; \
	done

linux: check
	CGO_ENABLED=1 go build -trimpath -ldflags="$(LDFLAGS)" -o $(DIST)/$(BINARY)-linux .

amd64: check
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
		go build -trimpath -ldflags="$(LDFLAGS)" -o $(DIST)/$(BINARY)-linux-amd64 .

arm64:
	CGO_ENABLED=1 GOOS=linux GOARCH=arm64 CC=aarch64-linux-gnu-gcc CXX=aarch64-linux-gnu-g++ \
		go build -trimpath -ldflags="$(LDFLAGS)" -o $(DIST)/$(BINARY)-linux-arm64 .

release: amd64 arm64

run: linux
	./$(DIST)/$(BINARY)-linux

clean:
	rm -rf $(DIST) $(BINARY)-*