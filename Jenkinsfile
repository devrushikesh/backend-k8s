pipeline{

    agent { label 'node1' }

    stages{

        stage('Clone the code'){
            steps{
                echo "Cloning the code"
            }
        }

        stage('Print the branch'){
            steps{
                echo "Branch ${env.BRANCH_NAME}"
            }
        }

    }

}