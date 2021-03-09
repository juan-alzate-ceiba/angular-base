pipeline {
  //Donde se va a ejecutar el Pipeline
  agent {
    label 'Slave_Induccion'
  }

  //Opciones específicas de Pipeline dentro del Pipeline
  // options {
  //   	buildDiscarder(logRotator(numToKeepStr: '3'))
 	//     disableConcurrentBuilds()
  // }

  //Una sección que define las herramientas “preinstaladas” en Jenkins
  // tools {
  //   jdk 'JDK8_Centos' //Preinstalada en la Configuración del Master
  //   gradle 'Gradle4.5_Centos' //Preinstalada en la Configuración del Master
  // }

  //Aquí comienzan los “items” del Pipeline
  stages{
    stage ('checkout'){
      steps{
        checkout scm
      }
    }
    stage ('install modules'){
      steps{
        sh '''
          npm install --verbose -d
          npm install --save classlist.js
        '''
      }
    }
    stage ('test'){
      steps{
        sh '''
          $(npm bin)/ng test --single-run --browsers Chrome_no_sandbox
        '''
      }

    stage('Static Code Analysis') {
      steps{
        echo '------------>Análisis de código estático<------------'
        withSonarQubeEnv('Sonar') {
sh "${tool name: 'SonarScanner', type:'hudson.plugins.sonar.SonarRunnerInstallation'}/bin/sonar-scanner -Dproject.settings=sonar-project.properties"
        }
      }
    }

    stage('Build') {
      steps {
        echo "------------>Build<------------"
        sh '$(npm bin)/ng build --prod --build-optimizer'
      }
    }
  }

  post {
    always {
      junit "test-results.xml"
    }
    // success {
    //   echo 'This will run only if successful'
    // }
    // failure {
    //   echo 'This will run only if failed'
    // }
    // unstable {
    //   echo 'This will run only if the run was marked as unstable'
    // }
    // changed {
    //   echo 'This will run only if the state of the Pipeline has changed'
    //   echo 'For example, if the Pipeline was previously failing but is now successful'
    // }
  }
}
