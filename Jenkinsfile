pipeline {
  //Donde se va a ejecutar el Pipeline
  agent {
    label 'Slave_Induccion'
  }

  //Opciones específicas de Pipeline dentro del Pipeline
  options {
    	buildDiscarder(logRotator(numToKeepStr: '3'))
 	disableConcurrentBuilds()
  }

  //Aquí comienzan los “items” del Pipeline
  stages{
    stage('Checkout') {
      steps{
        echo "------------>Checkout<------------"
        checkout([
        $class: 'GitSCM',
        branches: [[name: '*/master']],
        doGenerateSubmoduleConfigurations: false,
        extensions: [],
        gitTool: 'Default',
        submoduleCfg: [],
        userRemoteConfigs: [[
        credentialsId: 'GitHub_juan-alzate-ceiba',
        url:'https://github.com/juan-alzate-ceiba/angular-base.git'
        ]]
      ])

    }
  }

    stage('install & build') {
      steps{
        echo "------------>Unit Tests<------------"
        sh 'npm i'
        // sh 'npm run build'
      }
    }

    stage('test') {
      steps{
        echo "------------>Unit Tests<------------"
        sh 'ng test --watch=false --browsers ChromeHeadless --code-coverage'
      }
    }

    stage('Static Code Analysis') {
      steps{
        echo '------------>Análisis de código estático<------------'
        withSonarQubeEnv('Sonar') {
sh "${tool name: 'SonarScanner', type: 'hudson.plugins.sonar.SonarRunnerInstallation'}/bin/sonar-scanner -Dsonar.projectKey=co.com.ceiba.ceiba.adn:ADNjuanalzate -Dsonar.projectName=CeibaADN-angularbase(juan.alzate) -Dproject.settings=./sonar-project.properties"
        }
      }
    }

  }

  post {

    failure {
      echo 'This will run only if failed'
mail (to: 'juan.alzate@ceiba.com.co',subject: "Failed Pipeline:${currentBuild.fullDisplayName}",body: "Something is wrong with ${env.BUILD_URL}")

    }
  }
}
