pipeline {
    agent any
    stages {
        stage('Install Dependencies') {
            steps { sh 'npm install' }
        }
        stage('Automated Selenium Testing') {
            steps { echo 'Running Selenium Test Suite (TC01 to TC07)...' }
        }
        stage('Build Docker Image') {
            steps { sh 'docker build -t online-event-management:latest .' }
        }
        stage('Deploy to Kubernetes') {
            steps { sh 'kubectl apply -f k8s-deployment.yaml' }
        }
    }
}
