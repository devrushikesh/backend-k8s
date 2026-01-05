pipeline{

    agent { label 'node1' }

    stages{

        /* =========================
            DEBUG CONTEXT (MANDATORY)
           ========================= */

        stage('Debug Context') {
            steps {
                echo "BRANCH_NAME   = ${env.BRANCH_NAME}"
                echo "CHANGE_ID     = ${env.CHANGE_ID}"
                echo "CHANGE_BRANCH = ${env.CHANGE_BRANCH}"
                echo "CHANGE_TARGET = ${env.CHANGE_TARGET}"
            }
        }

        /* =========================
            INSTALL DEPENDENCIES
           ========================= */

        stage('Install Packages'){
            steps{
                sh 'npm install'
            }
        }


        /* =========================
            UNIT TESTS (ALWAYS)
           ========================= */

        stage('Unit Testing'){
            steps{
                sh 'npm test'
            }
        }


        /* =========================
            INTEGRATION TESTS
            ONLY AFTER MERGE TO DEVELOP
           ========================= */

        stage('Integration Testing'){
            when{
                allOf {
                    expression { env.CHANGE_ID == null }   // NOT a PR
                    branch 'develop'
                }
            }
            steps{
                echo "Running INTEGRATION tests"
                sh '''
                    docker run -d \
                        --name test-postgres \
                        -e POSTGRES_USER=postgres \
                        -e POSTGRES_PASSWORD=postgres \
                        -e POSTGRES_DB=todo_test_db \
                        -p 5432:5432 \
                        postgres:15
                '''
                sh 'sleep 10'

                sh '''
                    export DB_HOST=localhost
                    export DB_PORT=5432
                    export DB_USER=postgres
                    export DB_PASSWORD=postgres
                    export DB_NAME=todo_test_db

                    npm run test:integration
                '''
            }
            post {
                always {
                    sh 'docker rm -f test-postgres || true'
                }
            }
        }

         /* =========================
            Build Docker Image and Push
            ONLY AFTER MERGE TO DEVELOP
           ========================= */

        stage('Build Docker Image and Push to Repository'){
            when{
                allOf {
                    expression { env.CHANGE_ID == null }   // NOT a PR
                    branch 'develop'
                }
            }
            steps{
                echo "Creating docker image and pushing to ecr..."
            }
            
        }
        
    }
}