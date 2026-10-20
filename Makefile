MKCERT ?= $(HOME)/.local/bin/mkcert

MKCERT_OS := $(shell uname -s | tr '[:upper:]' '[:lower:]')
MKCERT_ARCH := $(shell uname -m)

ifeq ($(MKCERT_ARCH),x86_64)
MKCERT_ARCH := amd64
else ifeq ($(MKCERT_ARCH),aarch64)
MKCERT_ARCH := arm64
endif

ifeq ($(MKCERT_OS),linux)
LAN_IP ?= $(shell ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($$i == "src") {print $$(i+1); exit}}')
else ifeq ($(MKCERT_OS),darwin)
LAN_INTERFACE := $(shell route -n get default 2>/dev/null | awk '/interface:/ {print $$2; exit}')
LAN_IP ?= $(shell ifconfig "$(LAN_INTERFACE)" 2>/dev/null | awk '/inet / {print $$2; exit}')
endif

MKCERT_PLATFORM ?= $(MKCERT_OS)/$(MKCERT_ARCH)

up: certs
	@docker compose up -d --build
	@printf '\nLaunchpadbay:\t https://$(LAN_IP):8443 and https://localhost:8443\n'
	@printf 'Grafana:\t http://localhost:3001\n'
	@printf 'Prometheus:\t http://localhost:9090\n'

certs: $(MKCERT)
	@mkdir -p certs
	@if [ ! -f certs/backend.pem ] || [ ! -f certs/backend-key.pem ]; then \
		printf '\nSigning backend certificates...';\
		"$(MKCERT)" \
			-cert-file certs/backend.pem \
			-key-file certs/backend-key.pem \
			backend localhost 127.0.0.1 ::1 && \
		printf '\nBackend certificates signed.\n';\
	fi
	@if [ ! -f certs/frontend.pem ] || [ ! -f certs/frontend-key.pem ]; then \
		"$(MKCERT)" \
			-cert-file certs/frontend.pem \
			-key-file certs/frontend-key.pem \
			localhost 127.0.0.1 ::1 $(LAN_IP); \
	fi
	@cp "$$("$(MKCERT)" -CAROOT)/rootCA.pem" certs/ca.pem

$(MKCERT):
	mkdir -p "$(dir $(MKCERT))"
	curl -fL "https://dl.filippo.io/mkcert/v1.4.4?for=$(MKCERT_PLATFORM)" -o "$(MKCERT).download"
	chmod u+x "$(MKCERT).download"
	mv "$(MKCERT).download" "$(MKCERT)"

dev: up
	cd frontend && npm ci && npm run dev

down:
	docker compose down

re: down
	$(MAKE) up

fclean:
	docker compose down -v --rmi all
	rm -rf certs


.PHONY: up certs dev down re fclean
