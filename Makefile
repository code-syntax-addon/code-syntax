SINCE ?= origin/master
DESCRIPTION ?=
PROJECTS ?=
ALLOW_DIRTY ?= 0
DOCS_DEPLOYMENT_ID ?=
SLIDES_DEPLOYMENT_ID ?=

export DESCRIPTION DOCS_DEPLOYMENT_ID SLIDES_DEPLOYMENT_ID

RELEASE_TOOL = node tools/apps-script.mjs
SELECTION = $(if $(strip $(PROJECTS)),--projects "$(PROJECTS)",--since "$(SINCE)")
DIRTY_OPTION = $(if $(filter 1 true yes,$(ALLOW_DIRTY)),--allow-dirty,)

.PHONY: help setup login build clean plan status versions push push-all \
	push-codemirror push-theme push-docs push-slides release release-all \
	release-deploy test

help:
	@echo "Apps Script targets:"
	@echo "  make setup                         Install pinned npm deployment tools"
	@echo "  make login                         Log in with clasp 3.3.0"
	@echo "  make build                         Transpile all projects into staging dirs"
	@echo "  make plan [SINCE=ref]              Show changed projects and release order"
	@echo "  make status                        Show files clasp would push for all projects"
	@echo "  make push [SINCE=ref]              Push only changed Apps Script projects"
	@echo "  make push PROJECTS='docs slides'   Push an explicit project set"
	@echo "  make push-all                      Push all four projects"
	@echo "  make push-docs                     Push one project"
	@echo "  make release [SINCE=ref]           Push and version changed projects"
	@echo "  make release-all                   Push and version every project"
	@echo "  make release-deploy ...            Release and update existing deployments"
	@echo "  make versions                      List remote versions for every project"
	@echo ""
	@echo "Projects: codemirror theme docs slides"
	@echo "release-deploy requires DOCS_DEPLOYMENT_ID and/or SLIDES_DEPLOYMENT_ID."

setup:
	npm ci

login:
	npx --no-install clasp login

build:
	$(RELEASE_TOOL) build --all

clean:
	$(RELEASE_TOOL) clean --all

plan:
	$(RELEASE_TOOL) plan $(SELECTION)

status:
	$(RELEASE_TOOL) status --all

versions:
	$(RELEASE_TOOL) versions --all

push:
	$(RELEASE_TOOL) push $(SELECTION)

push-all:
	$(RELEASE_TOOL) push --all

push-codemirror push-theme push-docs push-slides:
	$(RELEASE_TOOL) push --projects "$(patsubst push-%,%,$@)"

release:
	$(RELEASE_TOOL) release $(SELECTION) $(DIRTY_OPTION)

release-all:
	$(RELEASE_TOOL) release --all $(DIRTY_OPTION)

release-deploy:
	$(RELEASE_TOOL) release $(SELECTION) --deploy $(DIRTY_OPTION)

test:
	npm --prefix tests test
