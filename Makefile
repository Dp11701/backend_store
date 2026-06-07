# Docker Hub — override khi build/push:
#   make docker-build DOCKER_USER=yourname TAG=v0.1.0
#   make docker-push  DOCKER_USER=yourname TAG=v0.1.0

DOCKER_USER ?= phundelima
IMAGE_NAME  ?= thien-nga-store
TAG         ?= latest
PLATFORM    ?= linux/amd64
IMAGE       := $(DOCKER_USER)/$(IMAGE_NAME):$(TAG)

DOCKER_BUILD_ARGS := -t $(IMAGE) -f Dockerfile
ifneq ($(PLATFORM),)
DOCKER_BUILD_ARGS += --platform $(PLATFORM)
endif

.PHONY: help docker-build docker-push docker-build-push docker-run docker-login docker-tag

help:
	@echo "Targets:"
	@echo "  docker-build       Build image $(IMAGE)"
	@echo "  docker-push        Push image to Docker Hub"
	@echo "  docker-build-push  Build then push"
	@echo "  docker-run         Run container (reads backend/.env)"
	@echo "  docker-login       Login to Docker Hub"
	@echo ""
	@echo "Variables: DOCKER_USER=$(DOCKER_USER) IMAGE_NAME=$(IMAGE_NAME) TAG=$(TAG)"

build:
	docker build $(DOCKER_BUILD_ARGS) .

push:
	docker push $(IMAGE)

build-push: build push

run:
	docker run --rm -p 8888:8888 --env-file .env $(IMAGE)

login:
	docker login
