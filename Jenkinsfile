pipeline{

    agent { label 'node1' }

    environment{
        AWS_REGION = 'ap-south-1'
        AWS_ACCOUNT = '759210286431'
        ECR_URL = "${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        IMAGE_NAME = 'todo-backend'
        ECR_REPO = "${ECR_URL}/${IMAGE_NAME}"
    }

    stages{

        /* =========================
            CHECKOUT REPOSITORY
           ========================= */

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.IMAGE_TAG = env.GIT_COMMIT.take(7)
                }
            }
        }

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
            FS SCAN (TRIVY)
           ========================= */

        stage('FileSystem Scan'){
            when{
                anyOf{
                    expression { env.CHANGE_ID != null }
                    branch 'feature/*'
                }
            }
            steps{
                sh """
                    trivy fs \
                    --severity HIGH,CRITICAL \
                    --exit-code 1 \
                    --no-progress \
                    .
                """
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

        stage('Build Docker Image'){
            when{
                allOf {
                    expression { env.CHANGE_ID == null }   // NOT a PR
                    branch 'develop'
                }
            }
            steps{
                sh "docker build -t ${ECR_REPO}:${IMAGE_TAG} ."
            } 
        }

        /* =========================
            IMAGE SCAN (TRIVY)
           ========================= */
        stage('Scan Image'){
            when{
                allOf {
                    expression { env.CHANGE_ID == null }   // NOT a PR
                    branch 'develop'
                }
            }
            steps{
                echo "Scanning image with Trivy"

                sh """
                    trivy image \
                        --severity HIGH,CRITICAL \
                        --exit-code 1 \
                        --no-progress \
                        --skip-dirs /usr/local/lib/node_modules/npm \
                        ${ECR_REPO}:${IMAGE_TAG}
                """
            }
        }

        /* =========================
            PUSH IMAGE TO ECR
           ========================= */
        stage('Push to ECR'){
            when{
                allOf {
                    expression { env.CHANGE_ID == null }   // NOT a PR
                    branch 'develop'
                }
            }
            steps{
                sh """
                    aws ecr get-login-password --region=${AWS_REGION}\
                    | docker login --username AWS --password-stdin ${ECR_URL}

                    docker push ${ECR_REPO}:${IMAGE_TAG}
                """
            }
            post{
                always {
                    sh "docker rmi -f ${ECR_REPO}:${IMAGE_TAG} || true"
                }
            }
        }


        /* =========================
            DEPLOY TO DEV ENVIRONMENT
           ========================= */
        stage('Deploy to Dev Environment'){
            when{
                allOf {
                    expression { env.CHANGE_ID == null }   // NOT a PR
                    branch 'develop'
                }
            }
            steps{
                echo 'Deploying to dev environment of k8s...'

                withCredentials([file(credentialsId: 'jenkins-kubeconfig', variable: 'KUBECONFIG')]) {
                    sh """
                        helm upgrade --install my-app helm/my-app \
                        -n dev \
                        --set image.tag=${IMAGE_TAG}

                    """
                }

            }
        }

        /* =========================
            DEPLOY TO PROD ENVIRONMENT
           ========================= */
        stage('Deploy to Prod Environment'){
            when{
                allOf {
                    expression { env.CHANGE_ID == null }   // NOT a PR
                    branch 'main'
                }
            }
            steps{
                echo 'Deploying to production environment of k8s...'
            }
        }



    }
}