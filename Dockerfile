# Use ubuntu trusty tar (14.04 LTS) as base image
FROM synec/nvm

MAINTAINER System Insights

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Define nvm version
ENV NVM_VERSION=v

# Define node version
ENV NODE_VERSION=6.2.0

ENV NVM_DIR=/root/.nvm

# Install xmllint
RUN apt-get update && apt-get install -y \
    libxml2-utils

# Fetch and install nodejs via nvm
RUN source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

# Export NODE_PATH
ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
# Update PATH to make node/npm accessible
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# Application

RUN mkdir -p /opt/systeminsights/connect-agent
COPY . /opt/systeminsights/connect-agent

WORKDIR /opt/systeminsights/connect-agent
RUN npm install
RUN npm install --only=dev

# TODO VOLUME /var/log/vimana
# TODO EXPORT ports
EXPOSE 7000
EXPOSE 8080


# overwrite this with 'CMD []' in a dependent Dockerfile
CMD ["/bin/bash"]