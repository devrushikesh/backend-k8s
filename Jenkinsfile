pipeline{

    agent { label 'node1' }

    stages{

        stage('Clone the code'){
            steps{
                echo "Cloning the code from branch ${env.BRANCH_NAME}"
            }
        }

        stage('Install Packages'){
            steps{
                sh 'npm install'
            }
        }

        stage('Unit Testing'){
            steps{
                sh 'npm test'
            }
        }


    }

}